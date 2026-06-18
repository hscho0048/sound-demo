// 캡쳐 이미지를 스토리보드 씬 순서대로 각 버전 폴더의 `씬별/` 하위로 복사 정리.
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'C:/Users/choho/Documents/storyboard_shots';
const DRAMA = `${BASE}/drama`;
const AD = `${BASE}/ad`;

// [씬, 원본파일, 정리파일명] — 원본이 null이면 데모에 없는 장면(안내 텍스트 생성)
const dramaScenes = [
  ['S13', 'report-top.png', 'S13_핸드폰-가전반응요약.png'],
  ['S14', 'device-robot-sensitive-on.png', 'S14_로봇청소기상세-민감설정ON.png'],
  ['S17', 'report-top.png', 'S17_세탁기부정기록.png'],
  ['S19', 'report-period-3day.png', 'S19_리포트-최근3일.png'],
  ['S20', 'report-gpt-button.png', 'S20_GPT리포트생성버튼.png'],
  ['S21', 'gpt-consent-popup.png', 'S21_GPT상세리포트-동의팝업.png'],
  ['S22', 'loading.png', 'S22_로딩화면.png'],
  ['S23', 'gpt-report-summary.png', 'S23_GPT요약리포트.png'],
  ['S24', 'gpt-report-detail.png', 'S24_GPT상세리포트-팝업.png'],
  ['S25', 'gpt-report-summary.png', 'S25_뒤로가기-요약화면.png'],
  ['S26', 'device-list.png', 'S26_기기목록-세탁기클릭.png'],
  ['S27', 'device-washer.png', 'S27_세탁기상세-루틴추천.png'],
  ['S28', 'device-washer.png', 'S28_세탁기상세-민감버튼.png'],
  ['S29', 'device-washer-sensitive-on.png', 'S29_세탁기-민감설정ON.png'],
  ['S33', null, 'S33_저소음모드전환안내팝업_데모에없음.txt']
];

const adScenes = [
  ['S14', 'home-reaction-recorded.png', 'S14_메인-긍정버튼-기록됨.png'],
  ['S15', '3d-view.png', 'S15_3D뷰-가전위치.png'],
  ['S16', 'device-list.png', 'S16_기기목록-세탁기.png'],
  ['S17', 'report-full.png', 'S17_리포트-전체스크롤.png'],
  ['S19', 'loading.png', 'S19_로딩화면.png'],
  ['S22', 'device-list.png', 'S22_기기목록-가전추가버튼.png'],
  ['S23', 'device-add-popup.png', 'S23_가전추가-세탁기검색.png'],
  ['S24', 'device-add-popup.png', 'S24_가전추가-세탁기추가.png'],
  ['S25', 'device-list.png', 'S25_세탁기추가완료.png'],
  ['S26', 'device-washer.png', 'S26_세탁기-실시간데시벨.png'],
  ['S30', null, 'S30_저소음모드전환안내팝업_데모에없음.txt'],
  ['S32', 'report-full.png', 'S32_리포트-스크롤다운.png'],
  ['S33', 'gpt-consent-popup.png', 'S33_리포트생성-동의팝업.png'],
  ['S34', 'gpt-report-detail.png', 'S34_GPT상세리포트-팝업.png'],
  ['S39', 'device-robot.png', 'S39_로봇청소기상세.png'],
  ['S40', 'device-robot.png', 'S40_로봇청소기-민감버튼.png'],
  ['S41', 'device-robot-sensitive-on.png', 'S41_로봇청소기-민감설정ON.png'],
  ['S46-48', '3d-view.png', 'S46-48_3D뷰-가전작동.png']
];

const NOTE = '이 장면(저소음 모드 전환 안내 팝업)은 현재 데모 앱에 해당 화면이 없습니다.\n영상 편집에서 안내 문구를 합성하거나, 요청 시 앱에 팝업 화면을 추가해 캡쳐할 수 있습니다.';

function organize(srcDir, scenes, label) {
  const outDir = `${srcDir}/씬별`;
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  let copied = 0, notes = 0;
  for (const [scene, src, dst] of scenes) {
    const target = path.join(outDir, dst);
    if (src === null) {
      fs.writeFileSync(target, NOTE, 'utf-8');
      notes += 1;
      continue;
    }
    const srcPath = path.join(srcDir, src);
    if (!fs.existsSync(srcPath)) { console.log('  MISSING', srcPath); continue; }
    fs.copyFileSync(srcPath, target);
    copied += 1;
  }
  console.log(`[${label}] 씬별 ${scenes.length}개 (이미지 ${copied}, 안내 ${notes}) -> ${outDir}`);
}

organize(DRAMA, dramaScenes, 'drama');
organize(AD, adScenes, 'ad');
console.log('DONE');
