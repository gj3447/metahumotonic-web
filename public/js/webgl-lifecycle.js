// KG: CONTRACT_LightVisual_WebGLLifecycle, ATOM_LightVisual_WebGLLifecycle
// WebGL 렌더러 생명주기 pub/sub. reduced-motion 감지 + context loss 복구.

(function (global) {
  'use strict';

  function createWebGLLifecycle(canvas) {
    const listeners = new Set();
    let state = 'active';
    let reinitFn = null;

    function notify(next) {
      state = next;
      listeners.forEach(function (l) { try { l(next); } catch (e) { console.warn('[lifecycle] listener error', e); } });
    }

    function subscribe(listener) {
      listeners.add(listener);
      try { listener(state); } catch (e) {}
      return function unsubscribe() { listeners.delete(listener); };
    }

    const reducedMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion) {
      if (reducedMotion.matches) state = 'paused';
      reducedMotion.addEventListener('change', function (e) {
        notify(e.matches ? 'paused' : 'active');
      });
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      notify('recovering');
    }, false);

    canvas.addEventListener('webglcontextrestored', async function () {
      if (typeof reinitFn === 'function') {
        try { await reinitFn(); } catch (e) { console.error('[lifecycle] reinit failed', e); }
      }
      notify('active');
    }, false);

    return {
      getState: function () { return state; },
      subscribe: subscribe,
      setReinit: function (fn) { reinitFn = fn; },
      // test hook (WEBGL_lose_context)
      _forceLoss: function () {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        const ext = gl && gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      },
    };
  }

  global.MHWebGLLifecycle = { create: createWebGLLifecycle };
})(typeof window !== 'undefined' ? window : globalThis);
