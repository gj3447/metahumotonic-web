// KG: CONTRACT_Feedback_FormUI, CONTRACT_Feedback_KeyboardA11y, ATOM_Feedback_FormUI, ATOM_Feedback_KeyboardA11y
// Liquid Glass 피드백 폼. 허니팟, aria, submit → POST /api/feedback

(function (global) {
  'use strict';

  const TEMPLATE = `
    <section class="mh-feedback" aria-labelledby="fb-title">
      <h2 id="fb-title" class="mh-fb-title">피드백 · Feedback</h2>
      <p class="mh-fb-intro">버그·제안·일반 문의는 이 폼으로 보내주세요. 답변은 Discord / 이메일(선택)로.</p>
      <form class="mh-fb-form" id="mh-fb-form" novalidate>
        <div class="mh-fb-field">
          <label for="fb-type">종류</label>
          <select id="fb-type" name="type" required aria-required="true">
            <option value="general">일반 문의</option>
            <option value="bug">버그 보고</option>
            <option value="feature">기능 제안</option>
          </select>
        </div>
        <div class="mh-fb-field">
          <label for="fb-subject">제목</label>
          <input id="fb-subject" name="subject" type="text" required maxlength="255" aria-required="true" placeholder="간단한 제목">
        </div>
        <div class="mh-fb-field">
          <label for="fb-body">내용</label>
          <textarea id="fb-body" name="body" rows="5" required maxlength="5000" aria-required="true" placeholder="무엇이든 편하게..."></textarea>
        </div>
        <div class="mh-fb-field">
          <label for="fb-email">이메일 (선택)</label>
          <input id="fb-email" name="email" type="email" maxlength="255" placeholder="답변 받고 싶다면">
        </div>
        <div class="mh-fb-honeypot" aria-hidden="true">
          <label>Leave blank</label>
          <input type="text" name="honeypot" tabindex="-1" autocomplete="off">
        </div>
        <div class="mh-fb-actions">
          <button type="submit" class="mh-fb-submit">보내기</button>
        </div>
        <p class="mh-fb-notice">
          개인정보 최소 수집. 이메일은 선택이며 응답 용도로만 사용. 언제든 삭제 요청 가능.
        </p>
        <div class="mh-fb-status" role="status" aria-live="polite" aria-atomic="true"></div>
      </form>
    </section>
  `;

  async function submit(form, statusEl) {
    const data = Object.fromEntries(new FormData(form));
    if (data.honeypot && data.honeypot.length > 0) {
      // 봇 — 조용히 성공처럼 응답
      statusEl.textContent = '보냈습니다. 감사합니다.';
      form.reset();
      return;
    }
    if (!data.subject || !data.body) {
      statusEl.textContent = '제목과 내용을 입력해주세요.';
      statusEl.classList.add('mh-fb-status--error');
      return;
    }
    statusEl.textContent = '보내는 중...';
    statusEl.classList.remove('mh-fb-status--error');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.status === 429) {
        statusEl.textContent = '너무 자주 보냈습니다. 잠시 후 다시 시도해주세요.';
        statusEl.classList.add('mh-fb-status--error');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(function () { return {}; });
        statusEl.textContent = '오류: ' + (err.reason || res.status);
        statusEl.classList.add('mh-fb-status--error');
        return;
      }
      statusEl.textContent = '✓ 보냈습니다. 감사합니다.';
      form.reset();
    } catch (e) {
      statusEl.textContent = '네트워크 오류. 잠시 후 다시 시도해주세요.';
      statusEl.classList.add('mh-fb-status--error');
      console.error('[feedback] submit error', e);
    }
  }

  function mount(anchor) {
    anchor.innerHTML = TEMPLATE;
    const form = anchor.querySelector('#mh-fb-form');
    const statusEl = anchor.querySelector('.mh-fb-status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit(form, statusEl);
    });
  }

  global.MHFeedbackForm = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
