const share = document.querySelector('#share');
const status = document.querySelector('#status');
const fallback = document.querySelector('#copy-fallback');
const url = 'https://metahumotonic.com/card/ra/';
share.hidden = false;

async function copyLink() {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(url);
    status.textContent = '명함 링크를 복사했습니다.';
  } catch {
    fallback.hidden = false;
    const field = document.querySelector('#card-url');
    field.focus();
    field.select();
    status.textContent = '명함 주소를 직접 복사할 수 있습니다.';
  }
}

share.addEventListener('click', async () => {
  status.textContent = '';
  fallback.hidden = true;
  if (navigator.share) {
    try {
      await navigator.share({ title: '라경준 · 대표이사 | 메타휴모토닉', url });
    } catch (error) {
      if (error.name !== 'AbortError') await copyLink();
    }
  } else {
    await copyLink();
  }
});
