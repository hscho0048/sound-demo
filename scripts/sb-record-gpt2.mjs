// 06_GPT리포트 / 00_전체 재녹화: 플로우는 screencast로, 상세 "팝업"은 동일 해상도
// 정지화면을 영상 끝에 이어붙인다. (screencast가 모달 합성 레이어를 못 담는 문제 우회)
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

process.env.PATH = path.dirname(ffmpegPath) + path.delimiter + process.env.PATH;
const URL = 'http://127.0.0.1:5300/';
const BASE = 'C:/Users/choho/Documents/storyboard_shots/videos';
const TMP = 'C:/Temp';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[gpt2]', ...a);
const PROFILES = [
  { key: 'app', dir: `${BASE}/app`, W: 390, H: 844, vp: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true } },
  { key: 'web', dir: `${BASE}/web`, W: 1440, H: 900, vp: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false } }
];
const browser = await puppeteer.launch({ headless: 'new', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl','--no-sandbox'] });

async function prep(vp) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  await page.evaluateOnNewDocument(() => {
    const kill = () => { try { document.querySelectorAll('html > div, html > iframe').forEach((e) => e.remove()); } catch (_) {} };
    const start = () => { kill(); try { new MutationObserver(kill).observe(document.documentElement, { childList: true }); } catch (_) {} };
    if (document.readyState !== 'loading') start(); else document.addEventListener('DOMContentLoaded', start);
    setInterval(kill, 250);
  });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  for (let i = 0; i < 45; i++) { if (!(await page.$('#app-splash'))) break; await sleep(700); }
  await page.evaluate(() => { location.hash = '#/home'; });
  await sleep(2500);
  return page;
}
const goto = async (page, h, w = 2500) => { await page.evaluate((x) => { location.hash = x; }, h); await sleep(w); };
const click = (page, s) => page.evaluate((x) => document.querySelector(x)?.click(), s);
const scrollBottom = async (page, w = 1500) => { await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); await sleep(w); };
const orbit = async (page) => {
  const box = await page.$eval('#three-home-container canvas', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }).catch(() => null);
  if (!box) return; const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 0; i < 20; i++) { await page.mouse.move(cx - i * 7, cy); await sleep(35); } await page.mouse.up();
};

// 리포트→생성→동의→상세 페이지 진입(스크롤로 도넛/표 보여주기). 모달은 열지 않음(녹화 후 별도).
async function gptFlow(page) {
  await click(page, '#generate-gpt-report'); await sleep(1600);
  await page.evaluate(() => { const cb = document.querySelector('#gpt-consent-checkbox'); if (cb) cb.checked = true; }); await sleep(800);
  await click(page, '#gpt-consent-agree');
  for (let i = 0; i < 30; i++) { if ((await page.evaluate(() => location.hash)).includes('gpt-detailed')) break; await sleep(1000); }
  await sleep(2500);
  await page.evaluate(() => window.scrollTo({ top: 350, behavior: 'smooth' })); await sleep(1800);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await sleep(1200);
}

// 모달을 열고 뷰포트 정지화면 캡쳐(영상 해상도와 동일).
async function modalStill(page, out) {
  for (let i = 0; i < 12; i++) { if ((await page.evaluate(() => document.querySelector('[data-view-report]')?.disabled)) === false) break; await sleep(400); }
  await click(page, '[data-view-report]'); await sleep(1200);
  if (!(await page.$('.gpt-report-modal__panel'))) { await click(page, '[data-view-report]'); await sleep(1000); }
  await page.evaluate(() => document.querySelectorAll('html > div, html > iframe').forEach((e) => e.remove()));
  await page.screenshot({ path: out });
}

function buildWithModal(webm, still, W, H, outMp4) {
  const flow = `${TMP}/_flow.mp4`; const modal = `${TMP}/_modal.mp4`;
  const sc = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`;
  execFileSync(ffmpegPath, ['-y', '-i', webm, '-vf', `${sc},format=yuv420p`, '-c:v', 'libx264', '-r', '30', flow], { stdio: 'ignore' });
  execFileSync(ffmpegPath, ['-y', '-loop', '1', '-t', '4', '-i', still, '-vf', `${sc},format=yuv420p`, '-c:v', 'libx264', '-r', '30', modal], { stdio: 'ignore' });
  execFileSync(ffmpegPath, ['-y', '-i', flow, '-i', modal, '-filter_complex', '[0:v][1:v]concat=n=2:v=1[v]', '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', outMp4], { stdio: 'ignore' });
  fs.unlinkSync(webm); fs.rmSync(flow, { force: true }); fs.rmSync(modal, { force: true });
}

for (const prof of PROFILES) {
  // 06_GPT리포트
  {
    const page = await prep(prof.vp);
    await goto(page, '#/reports', 2800); await scrollBottom(page, 1600);
    const webm = `${prof.dir}/06_GPT리포트.webm`;
    const rec = await page.screencast({ path: webm });
    await gptFlow(page);
    await rec.stop();
    const still = `${TMP}/_still_${prof.key}_06.png`;
    await modalStill(page, still);
    await page.close();
    buildWithModal(webm, still, prof.W, prof.H, `${prof.dir}/06_GPT리포트.mp4`);
    log(prof.key, '06 done', `${fs.statSync(`${prof.dir}/06_GPT리포트.mp4`).size} b`);
  }
  // 00_전체
  {
    const page = await prep(prof.vp);
    const webm = `${prof.dir}/00_전체.webm`;
    const rec = await page.screencast({ path: webm });
    await sleep(700);
    await click(page, '[data-noti-toggle]'); await sleep(2000); await click(page, '[data-noti-readall]'); await sleep(800);
    await page.evaluate(() => document.body.click()); await sleep(500);
    await click(page, '[data-reaction="POSITIVE"]'); await sleep(1500);
    await click(page, '[data-reaction="NEGATIVE"]'); await sleep(1500);
    await goto(page, '#/three-home', 6500); await orbit(page); await sleep(1600);
    await goto(page, '#/devices', 2200);
    await goto(page, '#/devices/rdev-washer', 4800); await click(page, '[data-sensitive-toggle]'); await sleep(1600);
    await goto(page, '#/reports', 2200); await scrollBottom(page, 1500);
    await gptFlow(page);
    await rec.stop();
    const still = `${TMP}/_still_${prof.key}_00.png`;
    await modalStill(page, still);
    await page.close();
    buildWithModal(webm, still, prof.W, prof.H, `${prof.dir}/00_전체.mp4`);
    log(prof.key, '00 done', `${fs.statSync(`${prof.dir}/00_전체.mp4`).size} b`);
  }
}
await browser.close();
log('ALL DONE');
