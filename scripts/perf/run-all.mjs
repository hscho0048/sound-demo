// HEAR:O 성능 테스트 매크로.
// npm run perf  →  ① 프로덕션 빌드 ② 번들 분석 ③ preview 서버 기동
//                  ④ 헤드리스 웹 지표/FPS ⑤ API 부하 ⑥ 통합 리포트 출력
//
// 옵션:
//   --skip-build   dist 가 이미 있으면 빌드 생략
//   --skip-api     API 부하 테스트 생략
//   --skip-web     헤드리스 웹 측정 생략
//   --ci           기준(budget) 미달 시 종료코드 1
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';
import config from './config.mjs';
import { measureBundle } from './measure-bundle.mjs';
import { measureWeb } from './measure-web.mjs';
import { measureApi } from './measure-api.mjs';
import { writeReport } from './report.mjs';

const args = new Set(process.argv.slice(2));
const isWin = process.platform === 'win32';

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: 'inherit', shell: isWin, ...opts });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 종료코드 ${code}`))));
  });
}

function startPreview(port) {
  const child = spawn('npm', ['run', 'preview', '--', '--port', String(port), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}

function stopProcess(child) {
  if (!child || child.killed) return;
  if (isWin) {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: true });
  } else {
    child.kill('SIGTERM');
  }
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch {
      /* 아직 안 뜸 */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const data = {};

  // ① 빌드
  if (args.has('--skip-build') && existsSync('dist')) {
    console.log('▶ 빌드 생략 (--skip-build, dist 존재)');
  } else {
    console.log('▶ 프로덕션 빌드 (vite build)…');
    await run('npm', ['run', 'build']);
  }

  // ② 번들 분석
  console.log('▶ 번들 용량 분석…');
  data.bundle = await measureBundle('dist');

  // ③④ preview 서버 + 웹 측정
  let preview = null;
  if (!args.has('--skip-web')) {
    const port = config.previewPort;
    const baseUrl = `http://localhost:${port}`;
    console.log(`▶ preview 서버 기동 (${baseUrl})…`);
    preview = startPreview(port);
    const up = await waitForServer(`${baseUrl}/`, 25000);
    if (!up) {
      stopProcess(preview);
      preview = null;
      data.web = { ok: false, skipped: true, reason: 'preview 서버 기동 실패' };
    } else {
      console.log('▶ 헤드리스 웹 지표 / 3D FPS 측정…');
      try {
        data.web = await measureWeb(baseUrl);
      } finally {
        stopProcess(preview);
        preview = null;
      }
    }
  }

  // ⑤ API 부하
  if (!args.has('--skip-api')) {
    console.log(`▶ API 부하 테스트 (${config.api.baseUrl}${config.api.endpoint})…`);
    data.api = await measureApi();
  }

  // ⑥ 리포트
  const failed = await writeReport(data, stamp);

  if (args.has('--ci') && failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n성능 테스트 실패:', err.message);
  process.exit(1);
});
