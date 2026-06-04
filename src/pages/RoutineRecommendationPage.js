import { applyRoutine, dismissRoutine, generateRoutineRecommendations, getRoutineRecommendations } from '../api/routineApi.js';
import { RoutineCard } from '../components/RoutineCard.js';

export async function renderRoutineRecommendationPage() {
  const routines = await getRoutineRecommendations();
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Routine Recommendations</p>
          <h1>자동 루틴 추천</h1>
          <p>저장된 소음 이벤트와 긍정·부정 반응을 기반으로 생성된 규칙 기반 추천입니다.</p>
        </div>
        <button id="generate-routines">추천 다시 생성</button>
      </div>
      <div id="routine-list" class="card-list card-list--wide">
        ${routines.map((routine) => RoutineCard(routine)).join('')}
      </div>
      <p id="routine-result" aria-live="polite"></p>
    </section>
  `;
}

export function mountRoutineRecommendationPage() {
  const resultEl = document.querySelector('#routine-result');
  document.querySelector('#generate-routines')?.addEventListener('click', async () => {
    const result = await generateRoutineRecommendations();
    resultEl.textContent = `추천 생성 완료: ${result.created ?? 0}건`;
  });
  document.querySelectorAll('[data-action="apply-routine"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const result = await applyRoutine(button.dataset.routineId);
      resultEl.textContent = `${result.id} 상태가 ${result.status}(으)로 변경되었습니다.`;
    });
  });
  document.querySelectorAll('[data-action="dismiss-routine"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const result = await dismissRoutine(button.dataset.routineId);
      resultEl.textContent = `${result.id} 상태가 ${result.status}(으)로 변경되었습니다.`;
    });
  });
}
