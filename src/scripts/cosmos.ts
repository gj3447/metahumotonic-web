// KG: ATOM_Landing_Starfield (전체 402줄 — light trails + stars + counters 통합)
//     SA: MetaHumotonic_Landing_v2 | L1: InteractiveUX | Counters_Scroll 합병됨
// 수학적으로 아름다운 빛의 궤적 — 황금비 나선 + 케플러 궤도 + 로즈 곡선
// Progressive Enhancement: JS 없어도 콘텐츠 읽힘

const PHI = 1.618033988749895;
const SPIRAL_B = Math.log(PHI) / (Math.PI / 2);
const TAU = Math.PI * 2;

interface Particle {
  angle: number;
  speed: number;
  color: readonly [number, number, number];
  trail: { x: number; y: number; alpha: number }[];
  orbit: 'spiral' | 'kepler';
  // kepler params
  semiMajor: number;
  eccentricity: number;
  phase: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  trail: { x: number; y: number; alpha: number }[];
}

const COLORS = {
  pink: [244, 114, 182] as const,
  cyan: [103, 232, 249] as const,
  purple: [167, 139, 250] as const,
  white: [224, 231, 255] as const,
};
const COLOR_LIST = [COLORS.pink, COLORS.cyan, COLORS.purple, COLORS.white];

function initCosmos(): void {
  const canvas = document.getElementById('cosmos-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0;
  let H = 0;
  let cx = 0;
  let cy = 0;

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    // position:fixed canvas는 offsetWidth가 기본값(300x150) 반환하므로 window 크기 사용
    W = window.innerWidth;
    H = window.innerHeight;
    canvas!.width = W * dpr;
    canvas!.height = H * dpr;
    canvas!.style.width = W + 'px';
    canvas!.style.height = H + 'px';
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2;
    cy = H / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  // --- Mouse Interaction — 빛이 마우스에 반응 ---
  let mouseX = cx;
  let mouseY = cy;
  let mouseActive = false;

  canvas!.style.pointerEvents = 'none'; // 아래 콘텐츠 클릭 가능
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    mouseActive = true;
  });
  document.addEventListener('mouseleave', () => { mouseActive = false; });

  // --- Stars ---
  const STAR_COUNT = prefersReducedMotion ? 40 : 120;
  const stars: Star[] = Array.from({ length: STAR_COUNT }, () => {
    const sizeClass = Math.random();
    const size = sizeClass < 0.5 ? 1 : sizeClass < 0.8 ? 1.5 : sizeClass < 0.95 ? 2 : 3;
    return {
      x: Math.random(),
      y: Math.random(),
      size,
      baseAlpha: 0.3 + Math.random() * 0.5,
      twinkleSpeed: 0.5 + Math.random() * 2,
      twinkleOffset: Math.random() * TAU,
    };
  });

  function drawStars(t: number): void {
    for (const s of stars) {
      const alpha = prefersReducedMotion
        ? s.baseAlpha
        : s.baseAlpha * (0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset));
      ctx!.fillStyle = `rgba(224,231,255,${alpha})`;
      ctx!.beginPath();
      ctx!.arc(s.x * W, s.y * H, s.size, 0, TAU);
      ctx!.fill();
    }
  }

  if (prefersReducedMotion) {
    drawStars(0);
    initCounters();
    return;
  }

  // --- Particles ---
  const TRAIL_LENGTH = 40;

  function createParticle(i: number): Particle {
    const isSpiral = i < 2;
    return {
      angle: (TAU / 4) * i,
      speed: 0.003 + Math.random() * 0.002,
      color: COLOR_LIST[i % COLOR_LIST.length],
      trail: [],
      orbit: isSpiral ? 'spiral' : 'kepler',
      semiMajor: Math.min(W, H) * (0.15 + i * 0.06),
      eccentricity: 0.4 + i * 0.1,
      phase: (TAU / 4) * i,
    };
  }

  let particles: Particle[] = Array.from({ length: 4 }, (_, i) => createParticle(i));

  // Recreate particles on resize to recalculate semiMajor
  const origResize = resize;
  resize = () => {
    origResize();
    particles = Array.from({ length: 4 }, (_, i) => createParticle(i));
  };
  // Re-attach
  window.removeEventListener('resize', origResize);
  window.addEventListener('resize', resize);

  // --- Shooting stars ---
  const shootingStars: ShootingStar[] = [];

  function maybeSpawnShootingStar(): void {
    if (Math.random() > 0.03 || shootingStars.length >= 3) return;
    const angle = Math.random() * TAU;
    const speed = 4 + Math.random() * 6;
    shootingStars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.abs(Math.sin(angle)) * speed + 2,
      life: 0,
      maxLife: 30 + Math.random() * 30,
      trail: [],
    });
  }

  function updateShootingStars(): void {
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const ss = shootingStars[i];
      ss.x += ss.vx;
      ss.y += ss.vy;
      ss.life++;
      const alpha = 1 - ss.life / ss.maxLife;
      ss.trail.push({ x: ss.x, y: ss.y, alpha });
      if (ss.trail.length > 20) ss.trail.shift();
      if (ss.life >= ss.maxLife) {
        shootingStars.splice(i, 1);
      }
    }
  }

  function drawShootingStars(): void {
    for (const ss of shootingStars) {
      if (ss.trail.length < 2) continue;
      for (let j = 1; j < ss.trail.length; j++) {
        const p0 = ss.trail[j - 1];
        const p1 = ss.trail[j];
        const a = p1.alpha * (j / ss.trail.length);
        ctx!.strokeStyle = `rgba(224,231,255,${a})`;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.moveTo(p0.x, p0.y);
        ctx!.lineTo(p1.x, p1.y);
        ctx!.stroke();
      }
      // Head glow
      const head = ss.trail[ss.trail.length - 1];
      const headAlpha = 1 - ss.life / ss.maxLife;
      const grad = ctx!.createRadialGradient(head.x, head.y, 0, head.x, head.y, 6);
      grad.addColorStop(0, `rgba(255,255,255,${headAlpha})`);
      grad.addColorStop(1, `rgba(255,255,255,0)`);
      ctx!.fillStyle = grad;
      ctx!.beginPath();
      ctx!.arc(head.x, head.y, 6, 0, TAU);
      ctx!.fill();
    }
  }

  // --- Kepler helper: mean anomaly -> eccentric anomaly (Newton) ---
  function solveKepler(M: number, e: number): number {
    let E = M;
    for (let i = 0; i < 8; i++) {
      E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }
    return E;
  }

  // --- Particle position ---
  function getPosition(p: Particle, t: number): { x: number; y: number; brightness: number } {
    if (p.orbit === 'spiral') {
      const theta = p.angle + t * p.speed * 60;
      const maxR = Math.min(W, H) * 0.35;
      const rawR = 8 * Math.exp(SPIRAL_B * (theta % (TAU * 3)));
      const r = (rawR % maxR) + 20;
      return {
        x: cx + r * Math.cos(theta),
        y: cy + r * Math.sin(theta),
        brightness: 0.6 + 0.4 * Math.sin(theta * 2),
      };
    }
    // Kepler ellipse
    const M = (t * p.speed * 40 + p.phase) % TAU;
    const E = solveKepler(M, p.eccentricity);
    const trueAnomaly = 2 * Math.atan2(
      Math.sqrt(1 + p.eccentricity) * Math.sin(E / 2),
      Math.sqrt(1 - p.eccentricity) * Math.cos(E / 2),
    );
    const r = p.semiMajor * (1 - p.eccentricity * Math.cos(E));
    const b = p.semiMajor * Math.sqrt(1 - p.eccentricity * p.eccentricity);
    const x = cx + r * Math.cos(trueAnomaly + p.phase);
    const y = cy + (r * b / p.semiMajor) * Math.sin(trueAnomaly + p.phase);
    // Kepler 2nd law: brighter at periapsis
    const rMin = p.semiMajor * (1 - p.eccentricity);
    const rMax = p.semiMajor * (1 + p.eccentricity);
    const brightness = 0.4 + 0.6 * (1 - (r - rMin) / (rMax - rMin));
    return { x, y, brightness };
  }

  // --- Draw particle + trail ---
  function drawParticle(p: Particle, t: number): void {
    const pos = getPosition(p, t);
    p.trail.push({ x: pos.x, y: pos.y, alpha: pos.brightness });
    if (p.trail.length > TRAIL_LENGTH) p.trail.shift();

    const [r, g, b] = p.color;

    // Trail
    for (let j = 0; j < p.trail.length; j++) {
      const pt = p.trail[j];
      const frac = j / p.trail.length;
      const alpha = frac * pt.alpha * 0.5;
      const size = 1 + frac * 2;
      ctx!.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx!.beginPath();
      ctx!.arc(pt.x, pt.y, size, 0, TAU);
      ctx!.fill();
    }

    // Head glow
    const glowR = 12 + pos.brightness * 8;
    const grad = ctx!.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
    grad.addColorStop(0, `rgba(${r},${g},${b},${pos.brightness * 0.8})`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},${pos.brightness * 0.3})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx!.fillStyle = grad;
    ctx!.beginPath();
    ctx!.arc(pos.x, pos.y, glowR, 0, TAU);
    ctx!.fill();

    // Core dot
    ctx!.fillStyle = `rgba(255,255,255,${pos.brightness * 0.9})`;
    ctx!.beginPath();
    ctx!.arc(pos.x, pos.y, 1.5, 0, TAU);
    ctx!.fill();
  }

  // --- Animation loop ---
  let frameId = 0;

  function frame(time: number): void {
    const t = time * 0.001;
    // clearRect는 CSS 픽셀 좌표 (setTransform으로 스케일 적용됨)
    ctx!.clearRect(0, 0, W, H);
    ctx!.globalCompositeOperation = 'lighter';

    drawStars(t);

    for (const p of particles) {
      drawParticle(p, t);
    }

    maybeSpawnShootingStar();
    updateShootingStars();
    drawShootingStars();

    // --- Mouse Glow — 마우스 위치에 빛나는 후광 ---
    if (mouseActive) {
      const grad = ctx!.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 120);
      grad.addColorStop(0, 'rgba(167, 139, 250, 0.15)');
      grad.addColorStop(0.3, 'rgba(244, 114, 182, 0.08)');
      grad.addColorStop(0.6, 'rgba(103, 232, 249, 0.04)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx!.fillStyle = grad;
      ctx!.fillRect(mouseX - 120, mouseY - 120, 240, 240);

      // 입자들이 마우스에 약간 끌림
      for (const p of particles) {
        if (p.trail.length > 0) {
          const last = p.trail[p.trail.length - 1];
          const dx = mouseX - last.x;
          const dy = mouseY - last.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 300 && dist > 10) {
            const pull = 0.5 / dist;
            p.phase += pull * (dx > 0 ? 0.001 : -0.001);
          }
        }
      }
    }

    ctx!.globalCompositeOperation = 'source-over';
    frameId = requestAnimationFrame(frame);
  }

  frameId = requestAnimationFrame(frame);

  // Cleanup on page navigation (Astro View Transitions)
  document.addEventListener('astro:before-swap', () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
  }, { once: true });

  initCounters();
}

// --- Counter animation ---
function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function initCounters(): void {
  const counters = document.querySelectorAll<HTMLElement>('.counter');
  if (counters.length === 0) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        observer.unobserve(el);

        const target = parseInt(el.dataset.count || '0', 10);
        if (prefersReducedMotion) {
          el.textContent = target.toLocaleString();
          return;
        }

        const duration = 2000;
        const start = performance.now();

        function tick(now: number): void {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const current = Math.round(easeOutExpo(progress) * target);
          el.textContent = current.toLocaleString();
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }
    },
    { threshold: 0.3 },
  );

  counters.forEach((c) => observer.observe(c));
}

// --- Bootstrap ---
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCosmos);
  } else {
    initCosmos();
  }
  // Astro View Transitions: re-init after page swap
  document.addEventListener('astro:after-swap', initCosmos);
}
