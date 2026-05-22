// KG: CONTRACT_LightVisual_PrismDispersion, CONTRACT_LightVisual_WebGLLifecycle, ATOM_LightVisual_PrismDispersion
// Bootstrap: ogl Renderer + fullscreen quad + prism-dispersion.frag

(function (global) {
  'use strict';

  const FRAG_URL = '/shaders/prism-dispersion.frag';
  const VERT = /* glsl */ `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;

  async function fetchShader() {
    const res = await fetch(FRAG_URL);
    if (!res.ok) throw new Error('shader fetch ' + res.status);
    return await res.text();
  }

  async function initPrismScene(canvas) {
    if (!global.ogl) {
      console.warn('[prism] ogl not loaded, skipping WebGL init');
      return { teardown: function () {} };
    }
    const { Renderer, Program, Mesh, Geometry } = global.ogl;
    const renderer = new Renderer({ canvas: canvas, alpha: false, antialias: true, dpr: Math.min(global.devicePixelRatio || 1, 2) });
    const gl = renderer.gl;
    gl.clearColor(0.02, 0.02, 0.08, 1);

    const fragSrc = await fetchShader();
    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
    });
    const program = new Program(gl, {
      vertex: VERT,
      fragment: fragSrc,
      uniforms: {
        uTime:           { value: 0 },
        uResolution:     { value: [canvas.clientWidth, canvas.clientHeight] },
        uMouseXY:        { value: [0.5, 0.5] },
        uScrollY:        { value: 0 },
        uRendererState:  { value: 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry: geometry, program: program });

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h);
      program.uniforms.uResolution.value = [w, h];
    }
    resize();
    global.addEventListener('resize', resize);

    function onMouseMove(e) {
      const r = canvas.getBoundingClientRect();
      program.uniforms.uMouseXY.value = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    }
    global.addEventListener('mousemove', onMouseMove, { passive: true });

    function onScroll() {
      program.uniforms.uScrollY.value = global.scrollY;
    }
    global.addEventListener('scroll', onScroll, { passive: true });

    // lifecycle subscription
    let unsubscribe = function () {};
    if (global.MHWebGLLifecycle) {
      const lifecycle = global.MHWebGLLifecycle.create(canvas);
      unsubscribe = lifecycle.subscribe(function (state) {
        program.uniforms.uRendererState.value = state === 'active' ? 0 : (state === 'paused' ? 1 : 2);
      });
    }

    let raf = 0, t0 = performance.now();
    function frame() {
      program.uniforms.uTime.value = (performance.now() - t0) / 1000;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(frame);
    }
    frame();

    return {
      teardown: function () {
        cancelAnimationFrame(raf);
        global.removeEventListener('resize', resize);
        global.removeEventListener('mousemove', onMouseMove);
        global.removeEventListener('scroll', onScroll);
        unsubscribe();
      },
    };
  }

  global.MHPrismScene = { init: initPrismScene };
})(typeof window !== 'undefined' ? window : globalThis);
