const root = document.querySelector<HTMLElement>('[data-soop-sim]');
if (root) {
  const controls = root.querySelector<HTMLElement>('[data-soop-controls]');
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-soop-mode]')];
  const kicker = root.querySelector<HTMLElement>('[data-soop-kicker]');
  const title = root.querySelector<HTMLElement>('[data-soop-reading-title]');
  const copy = root.querySelector<HTMLElement>('[data-soop-reading-copy]');
  const status = root.querySelector<HTMLElement>('[data-soop-status]');
  if (controls && kicker && title && copy) {
    controls.hidden = false;
    root.dataset.enhanced = 'true';
    const select = (mode: 'hyperedge' | 'pairs'): void => {
      root.dataset.mode = mode;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.soopMode === mode)));
      if (mode === 'pairs') {
        kicker.textContent = '02 / PAIRWISE PROJECTION';
        title.textContent = '선은 늘고, 맥락은 사라집니다';
        copy.textContent = '여섯 역할을 쌍으로 펼치면 가능한 선은 15개입니다. 이 선은 함께 등장할 수 있는 조합일 뿐, 개인 간 관계나 사건의 시간·역할·출처를 증명하지 않습니다.';
      } else {
        kicker.textContent = '01 / HYPEREDGE';
        title.textContent = '여섯 역할, 하나의 사건';
        copy.textContent = '커뮤니티를 중심으로 여러 역할이 같은 사건에 참여합니다. 참여의 맥락은 사건에 남고, 시간은 별도의 정점으로, 출처는 근거 사슬로 보존합니다.';
      }
      if (status) status.textContent = mode === 'pairs' ? '쌍별 선 15개 보기' : '공동 사건 하나 보기';
    };
    buttons.forEach(button => button.addEventListener('click', () => {
      if (button.dataset.soopMode === 'pairs' || button.dataset.soopMode === 'hyperedge') select(button.dataset.soopMode);
    }));
  }
}
