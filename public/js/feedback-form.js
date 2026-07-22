// KG: CONTRACT_Feedback_FormUI, CONTRACT_Feedback_KeyboardA11y
// Accessible same-origin feedback form -> POST /api/feedback.

(function (global) {
  'use strict';

  const TEMPLATE = `
    <section class="mh-feedback" aria-labelledby="mh-fb-title">
      <header class="mh-fb-header">
        <span class="mh-fb-index">FEEDBACK CHANNEL / 01</span>
        <span class="mh-fb-state">OPEN</span>
        <h3 id="mh-fb-title" class="mh-fb-title">한 문장으로 시작하십시오.</h3>
        <p class="mh-fb-intro">명제에 대한 반박, 구현 오류, 재현 결과와 협업 제안을 운영자 피드백함으로 보냅니다.</p>
      </header>
      <form class="mh-fb-form" id="mh-fb-form" novalidate aria-busy="false">
        <div class="mh-fb-row">
          <div class="mh-fb-field">
            <label for="mh-fb-type">종류</label>
            <select id="mh-fb-type" name="type" required aria-required="true">
              <option value="thesis">명제 반박</option>
              <option value="bug">오류 보고</option>
              <option value="feature">기능 제안</option>
              <option value="compute">333 · ORRR</option>
              <option value="collaboration">연구 · 협업</option>
              <option value="general">일반 의견</option>
            </select>
          </div>
          <div class="mh-fb-field">
            <label for="mh-fb-subject">제목</label>
            <input id="mh-fb-subject" name="subject" type="text" required maxlength="255" aria-required="true" placeholder="핵심을 한 문장으로">
          </div>
        </div>
        <div class="mh-fb-field">
          <label for="mh-fb-body">내용</label>
          <textarea id="mh-fb-body" name="body" rows="7" required maxlength="5000" aria-required="true" placeholder="틀린 점, 위험, 근거 또는 재현 방법을 적어주십시오."></textarea>
          <p class="mh-fb-help">최대 5,000자 · 비밀번호, API 키와 민감정보는 입력하지 마십시오.</p>
        </div>
        <div class="mh-fb-field">
          <label for="mh-fb-email">이메일 <span class="mh-fb-optional">선택</span></label>
          <input id="mh-fb-email" name="email" type="email" maxlength="255" autocomplete="email" aria-describedby="mh-fb-email-help" placeholder="답변을 원할 때만 입력">
          <p id="mh-fb-email-help" class="mh-fb-help">아래 답변 동의를 선택한 경우에만 서버로 전송됩니다.</p>
        </div>
        <div class="mh-fb-consent">
          <input id="mh-fb-storage-consent" type="checkbox" required aria-required="true">
          <label for="mh-fb-storage-consent"><strong>피드백 저장에 동의합니다. <span aria-hidden="true">*</span></strong>유형·제목·내용과 현재 페이지 경로는 검토를 위해 최대 365일 저장됩니다. IP와 User-Agent는 피드백 문서에 저장하지 않습니다. <a href="mailto:hi@metahumotonic.com?subject=Feedback%20deletion%20request">삭제 요청</a>을 보낼 수 있습니다.</label>
        </div>
        <div class="mh-fb-consent">
          <input id="mh-fb-contact-consent" type="checkbox" name="contact_consent" value="true" aria-describedby="mh-fb-email-help">
          <label for="mh-fb-contact-consent"><strong>이메일 답변에 동의합니다. <span class="mh-fb-optional">선택</span></strong>이메일을 입력했다면 이 항목을 선택해야 전송됩니다. 선택하지 않으면 이메일은 보내지 않습니다.</label>
        </div>
        <div class="mh-fb-honeypot" aria-hidden="true">
          <label for="mh-fb-company">Leave this field blank</label>
          <input id="mh-fb-company" type="text" name="honeypot" tabindex="-1" autocomplete="off">
        </div>
        <div class="mh-fb-actions">
          <p class="mh-fb-notice">전송 위치: <code>POST /api/feedback</code> · 현재 경로만 함께 기록</p>
          <button type="submit" class="mh-fb-submit">피드백 보내기</button>
        </div>
        <div class="mh-fb-status" role="status" aria-live="polite" aria-atomic="true"></div>
      </form>
    </section>
  `;

  function setStatus(statusEl, message, state) {
    statusEl.textContent = message;
    statusEl.dataset.state = state || '';
    statusEl.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
  }

  function localPath() {
    const value = global.location && typeof global.location.pathname === 'string'
      ? global.location.pathname
      : '/';
    return value.startsWith('/') && !value.startsWith('//') ? value : '/';
  }

  function payloadFrom(form) {
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();
    const contactConsent = form.querySelector('#mh-fb-contact-consent').checked;
    return {
      type: String(formData.get('type') || 'general'),
      subject: String(formData.get('subject') || '').trim(),
      body: String(formData.get('body') || '').trim(),
      email: contactConsent ? email : '',
      source_path: localPath(),
      contact_consent: Boolean(email && contactConsent),
      honeypot: String(formData.get('honeypot') || ''),
    };
  }

  function validate(form, statusEl) {
    const email = form.querySelector('#mh-fb-email');
    const contactConsent = form.querySelector('#mh-fb-contact-consent');
    email.setCustomValidity('');
    email.removeAttribute('aria-invalid');
    contactConsent.removeAttribute('aria-invalid');

    if (email.value.trim() && !contactConsent.checked) {
      email.setCustomValidity('이메일 답변 동의를 선택해 주십시오.');
      email.setAttribute('aria-invalid', 'true');
      contactConsent.setAttribute('aria-invalid', 'true');
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus(statusEl, '필수 항목과 동의 여부를 확인해 주십시오.', 'error');
      return false;
    }
    return true;
  }

  function failureMessage(response, reason) {
    if (response.status === 429 || reason === 'rate_limited') {
      return '요청이 너무 많습니다. 잠시 후 다시 시도해 주십시오.';
    }
    if (response.status === 403 || reason === 'challenge_failed') {
      return '보안 확인을 완료하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주십시오.';
    }
    if (response.status === 503 || reason === 'storage_unavailable') {
      return '저장되지 않았습니다. 잠시 후 다시 시도해 주십시오.';
    }
    if (response.status === 422) {
      return '입력값을 처리할 수 없습니다. 길이와 형식을 확인해 주십시오.';
    }
    return '피드백을 보내지 못했습니다. 잠시 후 다시 시도해 주십시오.';
  }

  async function submit(form, statusEl, endpoint) {
    if (!validate(form, statusEl)) return;

    const payload = payloadFrom(form);
    if (payload.honeypot) {
      setStatus(statusEl, '접수되었습니다.', 'accepted');
      form.reset();
      return;
    }

    const button = form.querySelector('.mh-fb-submit');
    form.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.textContent = '전송 중…';
    setStatus(statusEl, '피드백을 전송하고 있습니다.', 'pending');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(function () { return {}; });

      if (!response.ok || result.ok === false) {
        setStatus(statusEl, failureMessage(response, result.reason), 'error');
        return;
      }

      if (result.status === 'stored') {
        setStatus(statusEl, '✓ 안전하게 저장되었습니다. 검토 후 필요한 경우 답변드리겠습니다.', 'success');
      } else {
        setStatus(statusEl, '✓ 접수되었습니다. 현재 환경에서는 영구 저장 여부가 확인되지 않았습니다.', 'accepted');
      }
      form.reset();
    } catch (error) {
      setStatus(statusEl, '네트워크 오류로 전송되지 않았습니다. 연결을 확인한 뒤 다시 시도해 주십시오.', 'error');
      if (global.console && typeof global.console.error === 'function') {
        global.console.error('[feedback] submit failed', error);
      }
    } finally {
      form.setAttribute('aria-busy', 'false');
      button.disabled = false;
      button.textContent = '피드백 보내기';
    }
  }

  function mount(anchor) {
    if (!anchor || anchor.dataset.mhFeedbackMounted === 'true') return false;
    anchor.innerHTML = TEMPLATE;
    anchor.dataset.mhFeedbackMounted = 'true';
    const form = anchor.querySelector('#mh-fb-form');
    const statusEl = anchor.querySelector('.mh-fb-status');
    const endpoint = anchor.dataset.feedbackEndpoint || '/api/feedback';
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submit(form, statusEl, endpoint);
    });
    return true;
  }

  function autoMount() {
    document.querySelectorAll('[data-mh-feedback]').forEach(mount);
  }

  global.MHFeedbackForm = { mount: mount };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoMount, { once: true });
    } else {
      autoMount();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
