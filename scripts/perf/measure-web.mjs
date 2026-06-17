// 헤드리스 Chromium(puppeteer)으로 라우트별 로딩 지표(FCP/LCP/DCL/load)와
// JS 힙 사용량을 측정하고, 3D 라우트는 평균/최저 FPS 를 추가로 측정한다.
//
// 주의: 헤드리스 환경은 보통 GPU 없이 소프트웨어 렌더링(SwiftShader)을 쓰므로
// 3D FPS 는 실제 기기보다 낮게 나온다. 상대 비교/회귀 감지 용도로 본다.
import config from './config.mjs';

async function loadPuppeteer() {
  try {
    const mod = await import('puppeteer');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function stats(samples) {
  if (!samples.length) return null;
  const s = [...samples].sort((a, b) => a - b);
  const pct = (p) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  const sum = s.reduce((a, b) => a + b, 0);
  return { min: s[0], max: s[s.length - 1], avg: sum / s.length, p50: pct(50), p95: pct(95) };
}

async function measureRoute(browser, baseUrl, route) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 820, deviceScaleFactor: 1 });

  // LCP 는 PerformanceObserver 로 누적 기록해야 하므로 문서 로드 전에 주입한다.
  await page.evaluateOnNewDocument(() => {
    window.__lcp = 0;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      /* 미지원 브라우저 무시 */
    }
  });

  const url = `${baseUrl}/${route.hash}`;
  const result = { name: route.name, hash: route.hash, is3d: route.is3d };

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: config.navTimeoutMs });

    // 백엔드 미응답 시 뜨는 "오프라인으로 계속" 모달 제거 + 스플래시 강제 제거.
    await page.evaluate(() => {
      const off = [...document.querySelectorAll('button')].find((b) => /오프라인으로 계속/.test(b.textContent || ''));
      if (off) off.click();
      const s = document.getElementById('app-splash');
      if (s) s.remove();
    });

    if (route.waitFor) {
      await page.waitForSelector(route.waitFor, { timeout: 8000 }).catch(() => {});
    }

    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
      return {
        ttfb: nav.responseStart || 0,
        domContentLoaded: nav.domContentLoadedEventEnd || 0,
        load: nav.loadEventEnd || 0,
        fcp: fcpEntry ? fcpEntry.startTime : 0,
        lcp: window.__lcp || 0
      };
    });
    result.timing = timing;

    const metrics = await page.metrics();
    result.jsHeapMb = (metrics.JSHeapUsedSize || 0) / (1024 * 1024);
    result.domNodes = metrics.Nodes || 0;

    if (route.is3d) {
      // 캔버스 렌더가 시작될 시간을 약간 주고 프레임 수를 샘플링한다.
      await new Promise((r) => setTimeout(r, 600));
      const fps = await page.evaluate(
        (dur) =>
          new Promise((resolve) => {
            const frames = [];
            let last = performance.now();
            const start = last;
            const tick = (now) => {
              frames.push(now - last);
              last = now;
              if (now - start < dur) requestAnimationFrame(tick);
              else {
                const elapsed = (now - start) / 1000;
                resolve({ count: frames.length, elapsed, frameTimes: frames });
              }
            };
            requestAnimationFrame(tick);
          }),
        config.fpsDurationMs
      );
      const frameStats = stats(fps.frameTimes.slice(1)); // 첫 프레임은 워밍업이라 제외
      result.fps = {
        avg: fps.count / fps.elapsed,
        worst: frameStats ? 1000 / frameStats.max : 0, // 최악 프레임 기준 순간 FPS
        p95FrameMs: frameStats ? frameStats.p95 : 0,
        hasCanvas: await page.evaluate(() => !!document.querySelector('canvas'))
      };
    }
  } catch (err) {
    result.error = err.message;
  } finally {
    await page.close().catch(() => {});
  }

  return result;
}

export async function measureWeb(baseUrl) {
  const puppeteer = await loadPuppeteer();
  if (!puppeteer) {
    return { ok: false, skipped: true, reason: 'puppeteer 미설치 (npm i -D puppeteer)', routes: [] };
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader']
    });
  } catch (err) {
    return { ok: false, skipped: true, reason: `Chromium 실행 실패: ${err.message}`, routes: [] };
  }

  const routes = [];
  try {
    for (const route of config.routes) {
      // eslint-disable-next-line no-await-in-loop
      routes.push(await measureRoute(browser, baseUrl, route));
    }
  } finally {
    await browser.close().catch(() => {});
  }

  // budget 체크 (대표 라우트 기준: Home).
  const home = routes.find((r) => r.hash === '#/home') || routes[0];
  const b = config.budgets;
  const checks = [];
  if (home && home.timing) {
    checks.push({ name: 'FCP (Home)', value: home.timing.fcp, budget: b.fcpMs, unit: 'ms', pass: home.timing.fcp <= b.fcpMs });
    checks.push({ name: 'LCP (Home)', value: home.timing.lcp, budget: b.lcpMs, unit: 'ms', pass: home.timing.lcp <= b.lcpMs });
  }
  for (const r of routes.filter((x) => x.is3d && x.fps)) {
    checks.push({
      name: `평균 FPS (${r.name})`,
      value: r.fps.avg,
      budget: b.minFps,
      unit: 'fps',
      lowerIsBad: true,
      pass: r.fps.avg >= b.minFps
    });
  }

  return { ok: true, routes, checks, note: '3D FPS 는 헤드리스 소프트웨어 렌더링 기준이라 실기기보다 낮게 측정됩니다.' };
}
