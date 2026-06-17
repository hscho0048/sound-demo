// 측정 결과를 모아 콘솔 요약 + Markdown + HTML 리포트로 출력한다.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import config from './config.mjs';

const KB = 1024;
const r1 = (n) => (n == null ? '-' : Number(n).toFixed(1));
const r0 = (n) => (n == null ? '-' : Math.round(Number(n)));

function collectChecks(data) {
  const all = [];
  for (const [section, res] of Object.entries(data)) {
    if (res && res.checks) {
      for (const c of res.checks) all.push({ section, ...c });
    }
  }
  return all;
}

function consoleSummary(data) {
  const line = '─'.repeat(58);
  console.log(`\n${line}`);
  console.log('  HEAR:O 성능 리포트');
  console.log(line);

  if (data.bundle?.ok) {
    console.log(`\n[번들] 코드(JS+CSS) ${r1(data.bundle.codeGzip / KB)} KB gzip / ${r1(data.bundle.codeRaw / KB)} KB raw`);
    console.log(`       정적 자산 ${r1(data.bundle.assetRaw / KB)} KB raw (이미지/3D 모델/폰트)`);
    if (data.bundle.largestChunk) {
      console.log(`       최대 JS 청크: ${data.bundle.largestChunk.file} (${r1(data.bundle.largestChunk.gzip / KB)} KB gzip)`);
    }
  } else if (data.bundle) {
    console.log(`\n[번들] 건너뜀: ${data.bundle.error}`);
  }

  if (data.web?.ok) {
    console.log('\n[웹 로딩 / FPS]');
    for (const route of data.web.routes) {
      if (route.error) {
        console.log(`  ${route.name.padEnd(10)} 오류: ${route.error}`);
        continue;
      }
      const t = route.timing || {};
      let s = `  ${route.name.padEnd(10)} FCP ${r0(t.fcp)}ms  LCP ${r0(t.lcp)}ms  load ${r0(t.load)}ms  heap ${r1(route.jsHeapMb)}MB`;
      if (route.fps) s += `  |  avg ${r1(route.fps.avg)}fps (worst ${r1(route.fps.worst)})`;
      console.log(s);
    }
    if (data.web.note) console.log(`  * ${data.web.note}`);
  } else if (data.web?.skipped) {
    console.log(`\n[웹 로딩 / FPS] 건너뜀: ${data.web.reason}`);
  }

  if (data.api?.ok) {
    const l = data.api.latency;
    console.log('\n[API 부하]');
    console.log(`  ${data.api.url}`);
    console.log(`  ${data.api.requests}req / 동시 ${data.api.concurrency}  성공률 ${r1(data.api.successRate)}%  처리량 ${r1(data.api.throughput)} req/s`);
    console.log(`  지연 p50 ${r0(l.p50)}ms  p95 ${r0(l.p95)}ms  p99 ${r0(l.p99)}ms  (avg ${r0(l.avg)}ms)`);
  } else if (data.api?.skipped) {
    console.log(`\n[API 부하] 건너뜀: ${data.api.reason}`);
  }

  const checks = collectChecks(data);
  if (checks.length) {
    console.log('\n[기준 판정]');
    for (const c of checks) {
      const mark = c.pass ? 'PASS' : 'FAIL';
      const cmp = c.lowerIsBad ? '>=' : '<=';
      console.log(`  [${mark}] ${c.name}: ${r1(c.value)}${c.unit} (기준 ${cmp} ${c.budget}${c.unit})`);
    }
  }
  console.log(`\n${line}`);
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`  결과: ${checks.length - failed}/${checks.length} 통과${failed ? `  (FAIL ${failed})` : ''}`);
  console.log(`${line}\n`);
  return failed;
}

function buildMarkdown(data, stamp) {
  const out = [];
  out.push(`# HEAR:O 성능 리포트`, '', `생성: ${stamp}`, '');

  if (data.bundle?.ok) {
    out.push('## 번들 용량', '');
    out.push(`- 코드(JS+CSS): **${r1(data.bundle.codeGzip / KB)} KB** (gzip) / ${r1(data.bundle.codeRaw / KB)} KB (raw)`);
    out.push(`- 정적 자산: ${r1(data.bundle.assetRaw / KB)} KB (raw, 이미지/3D 모델/폰트)`, '');
    out.push('| 파일 | 타입 | gzip | raw |', '| --- | --- | ---: | ---: |');
    for (const f of data.bundle.topFiles) {
      out.push(`| ${f.file} | ${f.type} | ${r1(f.gzip / KB)} KB | ${r1(f.raw / KB)} KB |`);
    }
    out.push('');
  }

  if (data.web?.ok) {
    out.push('## 웹 로딩 / 3D FPS', '');
    out.push('| 라우트 | FCP | LCP | DCL | load | JS heap | DOM | 평균 FPS | worst FPS |');
    out.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const r of data.web.routes) {
      if (r.error) {
        out.push(`| ${r.name} | 오류: ${r.error} | | | | | | | |`);
        continue;
      }
      const t = r.timing || {};
      out.push(
        `| ${r.name} | ${r0(t.fcp)}ms | ${r0(t.lcp)}ms | ${r0(t.domContentLoaded)}ms | ${r0(t.load)}ms | ${r1(r.jsHeapMb)}MB | ${r0(r.domNodes)} | ${r.fps ? r1(r.fps.avg) : '-'} | ${r.fps ? r1(r.fps.worst) : '-'} |`
      );
    }
    if (data.web.note) out.push('', `> ${data.web.note}`);
    out.push('');
  } else if (data.web?.skipped) {
    out.push('## 웹 로딩 / 3D FPS', '', `> 건너뜀: ${data.web.reason}`, '');
  }

  if (data.api?.ok) {
    const l = data.api.latency;
    out.push('## API 부하', '');
    out.push(`- 대상: \`${data.api.url}\``);
    out.push(`- ${data.api.requests} 요청 / 동시성 ${data.api.concurrency} / 성공률 ${r1(data.api.successRate)}% / 처리량 ${r1(data.api.throughput)} req/s`);
    out.push('', '| 지표 | min | avg | p50 | p95 | p99 | max |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
    out.push(`| 응답시간(ms) | ${r0(l.min)} | ${r0(l.avg)} | ${r0(l.p50)} | ${r0(l.p95)} | ${r0(l.p99)} | ${r0(l.max)} |`);
    out.push('');
  } else if (data.api?.skipped) {
    out.push('## API 부하', '', `> 건너뜀: ${data.api.reason}`, '');
  }

  const checks = collectChecks(data);
  if (checks.length) {
    out.push('## 기준 판정', '', '| 항목 | 측정값 | 기준 | 결과 |', '| --- | ---: | ---: | :---: |');
    for (const c of checks) {
      const cmp = c.lowerIsBad ? '≥' : '≤';
      out.push(`| ${c.name} | ${r1(c.value)}${c.unit} | ${cmp} ${c.budget}${c.unit} | ${c.pass ? '✅ PASS' : '❌ FAIL'} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

function buildHtml(data, stamp) {
  const checks = collectChecks(data);
  const badge = (pass) =>
    `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;color:#fff;background:${pass ? '#16a34a' : '#dc2626'}">${pass ? 'PASS' : 'FAIL'}</span>`;

  const bundleRows = data.bundle?.ok
    ? data.bundle.topFiles
        .map((f) => `<tr><td>${f.file}</td><td>${f.type}</td><td class="n">${r1(f.gzip / KB)}</td><td class="n">${r1(f.raw / KB)}</td></tr>`)
        .join('')
    : '';

  const webRows = data.web?.ok
    ? data.web.routes
        .map((r) => {
          if (r.error) return `<tr><td>${r.name}</td><td colspan="8" class="err">오류: ${r.error}</td></tr>`;
          const t = r.timing || {};
          return `<tr><td>${r.name}</td><td class="n">${r0(t.fcp)}</td><td class="n">${r0(t.lcp)}</td><td class="n">${r0(t.domContentLoaded)}</td><td class="n">${r0(t.load)}</td><td class="n">${r1(r.jsHeapMb)}</td><td class="n">${r0(r.domNodes)}</td><td class="n">${r.fps ? r1(r.fps.avg) : '-'}</td><td class="n">${r.fps ? r1(r.fps.worst) : '-'}</td></tr>`;
        })
        .join('')
    : '';

  const apiBlock = data.api?.ok
    ? `<p>대상 <code>${data.api.url}</code> · ${data.api.requests}req / 동시성 ${data.api.concurrency} · 성공률 ${r1(data.api.successRate)}% · 처리량 ${r1(data.api.throughput)} req/s</p>
       <table><thead><tr><th>지표</th><th>min</th><th>avg</th><th>p50</th><th>p95</th><th>p99</th><th>max</th></tr></thead>
       <tbody><tr><td>응답(ms)</td><td class="n">${r0(data.api.latency.min)}</td><td class="n">${r0(data.api.latency.avg)}</td><td class="n">${r0(data.api.latency.p50)}</td><td class="n">${r0(data.api.latency.p95)}</td><td class="n">${r0(data.api.latency.p99)}</td><td class="n">${r0(data.api.latency.max)}</td></tr></tbody></table>`
    : `<p class="skip">건너뜀: ${data.api?.reason || '-'}</p>`;

  const checkRows = checks
    .map((c) => `<tr><td>${c.name}</td><td class="n">${r1(c.value)}${c.unit}</td><td class="n">${c.lowerIsBad ? '≥' : '≤'} ${c.budget}${c.unit}</td><td>${badge(c.pass)}</td></tr>`)
    .join('');

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HEAR:O 성능 리포트</title>
<style>
:root{--mint:#28c7b0;--ink:#333238}
*{box-sizing:border-box}
body{font-family:-apple-system,Segoe UI,Roboto,'Malgun Gothic',sans-serif;color:var(--ink);margin:0;padding:32px;background:#f4f6f8}
.wrap{max-width:960px;margin:0 auto}
h1{display:flex;align-items:center;gap:10px;font-size:24px}
h1 .dot{color:var(--mint)}
h2{margin-top:34px;font-size:18px;border-left:4px solid var(--mint);padding-left:10px}
.meta{color:#7a8590;font-size:13px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);font-size:13px;margin-top:8px}
th,td{padding:9px 12px;text-align:left;border-bottom:1px solid #eef1f4}
th{background:#fafbfc;font-weight:700;color:#55606b}
td.n{text-align:right;font-variant-numeric:tabular-nums}
td.err{color:#dc2626}
.skip{color:#9aa5b1;font-style:italic}
code{background:#eef1f4;padding:1px 6px;border-radius:5px;font-size:12px}
.note{color:#7a8590;font-size:12px;margin-top:6px}
</style></head><body><div class="wrap">
<h1>HEAR<span class="dot">:O</span> 성능 리포트</h1>
<p class="meta">생성: ${stamp}</p>

<h2>기준 판정</h2>
<table><thead><tr><th>항목</th><th>측정값</th><th>기준</th><th>결과</th></tr></thead><tbody>${checkRows || '<tr><td colspan="4" class="skip">판정 항목 없음</td></tr>'}</tbody></table>

<h2>번들 용량</h2>
${
  data.bundle?.ok
    ? `<p>코드(JS+CSS) <b>${r1(data.bundle.codeGzip / KB)} KB</b> gzip / ${r1(data.bundle.codeRaw / KB)} KB raw · 정적 자산 ${r1(data.bundle.assetRaw / KB)} KB raw</p>
       <table><thead><tr><th>파일</th><th>타입</th><th>gzip(KB)</th><th>raw(KB)</th></tr></thead><tbody>${bundleRows}</tbody></table>`
    : `<p class="skip">건너뜀: ${data.bundle?.error || '-'}</p>`
}

<h2>웹 로딩 / 3D FPS</h2>
${
  data.web?.ok
    ? `<table><thead><tr><th>라우트</th><th>FCP(ms)</th><th>LCP(ms)</th><th>DCL(ms)</th><th>load(ms)</th><th>heap(MB)</th><th>DOM</th><th>avg FPS</th><th>worst</th></tr></thead><tbody>${webRows}</tbody></table>
       <p class="note">${data.web.note || ''}</p>`
    : `<p class="skip">건너뜀: ${data.web?.reason || '-'}</p>`
}

<h2>API 부하</h2>
${apiBlock}

</div></body></html>`;
}

export async function writeReport(data, stamp) {
  const failed = consoleSummary(data);
  const md = buildMarkdown(data, stamp);
  const html = buildHtml(data, stamp);
  await mkdir(config.outDir, { recursive: true });
  await writeFile(join(config.outDir, 'report.json'), JSON.stringify({ stamp, ...data }, null, 2));
  await writeFile(join(config.outDir, 'report.md'), md);
  await writeFile(join(config.outDir, 'report.html'), html);
  console.log(`리포트 저장: ${config.outDir}/report.html  (md / json 동시 생성)\n`);
  return failed;
}
