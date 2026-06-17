// dist/ 빌드 산출물의 용량을 분석한다. raw + gzip 크기를 파일별로 측정하고
// 전체 합계 / 가장 큰 JS 청크 / 타입별 분포를 계산한다.
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import config from './config.mjs';

const KB = 1024;

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function classify(ext) {
  if (ext === '.js' || ext === '.mjs') return 'js';
  if (ext === '.css') return 'css';
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.gif'].includes(ext)) return 'image';
  if (['.glb', '.gltf', '.bin'].includes(ext)) return 'model';
  if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) return 'font';
  return 'other';
}

export async function measureBundle(distDir = 'dist') {
  if (!existsSync(distDir)) {
    return { ok: false, error: `빌드 산출물이 없습니다: ${distDir} (먼저 npm run build)`, files: [] };
  }

  const paths = await walk(distDir);
  const files = [];
  const byType = {};
  let totalRaw = 0;
  let totalGzip = 0;

  for (const p of paths) {
    const { size } = await stat(p);
    const ext = extname(p).toLowerCase();
    const type = classify(ext);
    // gzip 은 텍스트/스크립트성 자산에만 의미가 있다. 이미지/모델은 raw 로 본다.
    let gzip = size;
    if (type === 'js' || type === 'css' || type === 'other') {
      try {
        gzip = gzipSync(await readFile(p)).length;
      } catch {
        gzip = size;
      }
    }
    const rel = relative(distDir, p).replace(/\\/g, '/');
    files.push({ file: rel, type, raw: size, gzip });
    totalRaw += size;
    totalGzip += gzip;
    byType[type] = byType[type] || { raw: 0, gzip: 0, count: 0 };
    byType[type].raw += size;
    byType[type].gzip += gzip;
    byType[type].count += 1;
  }

  files.sort((a, b) => b.gzip - a.gzip);
  const jsFiles = files.filter((f) => f.type === 'js');
  const largestChunk = jsFiles[0] || null;

  // 코드(JS+CSS)와 정적 자산(이미지/모델/폰트)을 분리한다. 용량 예산은 코드에만 건다.
  // 3D 모델(.glb) 등은 앱 특성상 크므로 합산하면 의미가 흐려진다 → 따로 보고만 한다.
  const isCode = (t) => t === 'js' || t === 'css';
  const codeGzip = files.filter((f) => isCode(f.type)).reduce((s, f) => s + f.gzip, 0);
  const codeRaw = files.filter((f) => isCode(f.type)).reduce((s, f) => s + f.raw, 0);
  const assetRaw = files.filter((f) => !isCode(f.type)).reduce((s, f) => s + f.raw, 0);

  const budgets = config.budgets;
  const checks = [
    {
      name: '코드(JS+CSS) gzip',
      value: codeGzip / KB,
      budget: budgets.bundleTotalGzipKb,
      unit: 'KB',
      pass: codeGzip / KB <= budgets.bundleTotalGzipKb
    },
    {
      name: '최대 JS 청크 gzip',
      value: largestChunk ? largestChunk.gzip / KB : 0,
      budget: budgets.largestChunkGzipKb,
      unit: 'KB',
      pass: !largestChunk || largestChunk.gzip / KB <= budgets.largestChunkGzipKb
    }
  ];

  return {
    ok: true,
    totalRaw,
    totalGzip,
    codeGzip,
    codeRaw,
    assetRaw,
    byType,
    files,
    topFiles: files.slice(0, 12),
    largestChunk,
    checks
  };
}

// 단독 실행: node scripts/perf/measure-bundle.mjs
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  measureBundle().then((r) => {
    if (!r.ok) {
      console.error(r.error);
      process.exit(1);
    }
    console.log(`\n코드(JS+CSS): ${(r.codeGzip / KB).toFixed(1)} KB gzip / ${(r.codeRaw / KB).toFixed(1)} KB raw`);
    console.log(`정적 자산:   ${(r.assetRaw / KB).toFixed(1)} KB raw (이미지/3D 모델/폰트)`);
    console.log('상위 파일:');
    for (const f of r.topFiles) {
      console.log(`  ${(f.gzip / KB).toFixed(1).padStart(8)} KB  ${f.file}`);
    }
  });
}
