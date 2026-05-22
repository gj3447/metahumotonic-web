// KG: ATOM_Landing_KGPreview (225줄 — Canvas 2D 하이퍼그래프 시각화)
//     SA: MetaHumotonic_Landing_v2 | L1: InteractiveUX
// CHU: 계산가능하이퍼우주 (Computable Hypergraph Universe) 3D Visualization
// 하이퍼그래프 노드+하이퍼엣지가 3D 공간에서 회전하며 빛나는 입체 디스플레이
// Progressive Enhancement: JS 없어도 정적 CSS 폴백

const TAU = Math.PI * 2;
const PHI = 1.618033988749895;

interface HyperNode {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  color: readonly [number, number, number];
  size: number;
  label: string;
  domain: number; // 0-12 domain index
}

interface HyperEdge {
  nodes: number[]; // indices into nodes array
  color: readonly [number, number, number];
  alpha: number;
}

const DOMAIN_COLORS: readonly (readonly [number, number, number])[] = [
  [244, 114, 182], // pink — personal
  [167, 139, 250], // purple — math/physics
  [103, 232, 249], // cyan — literature
  [255, 215, 0],   // gold — religion
  [139, 92, 246],  // deep purple — CS
  [6, 182, 212],   // teal — infra
  [248, 113, 113], // red — APT
  [52, 211, 153],  // emerald — community
  [251, 191, 36],  // amber — streaming
  [224, 231, 255], // white — cross-domain
  [217, 70, 161],  // magenta — philosophy
  [16, 185, 129],  // green — ontology
  [99, 102, 241],  // indigo — meta
];

function initCHU(): void {
  const canvas = document.getElementById('chu-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0;

  function resize(): void {
    W = canvas!.width = canvas!.offsetWidth * (window.devicePixelRatio > 1 ? 2 : 1);
    H = canvas!.height = canvas!.offsetHeight * (window.devicePixelRatio > 1 ? 2 : 1);
    ctx!.scale(window.devicePixelRatio > 1 ? 2 : 1, window.devicePixelRatio > 1 ? 2 : 1);
  }
  resize();
  window.addEventListener('resize', resize);

  const displayW = () => canvas!.offsetWidth;
  const displayH = () => canvas!.offsetHeight;

  // --- Generate hypergraph nodes on sphere surface (fibonacci lattice) ---
  const NODE_COUNT = 42; // 숫자의 의미: 은하수를 여행하는 히치하이커
  const nodes: HyperNode[] = [];

  const domainLabels = [
    '라경준', 'Math', 'Literature', 'Religion', 'CS',
    'Infra', 'APT', 'Community', 'Stream', 'CrossDomain',
    'Philosophy', 'Ontology', 'Meta'
  ];

  for (let i = 0; i < NODE_COUNT; i++) {
    // Fibonacci sphere distribution — 균일 분포
    const theta = Math.acos(1 - 2 * (i + 0.5) / NODE_COUNT);
    const phi = TAU * i / PHI;
    const r = 120 + Math.random() * 30;

    const domain = i % 13;
    nodes.push({
      x: r * Math.sin(theta) * Math.cos(phi),
      y: r * Math.sin(theta) * Math.sin(phi),
      z: r * Math.cos(theta),
      vx: (Math.random() - 0.5) * 0.1,
      vy: (Math.random() - 0.5) * 0.1,
      vz: (Math.random() - 0.5) * 0.1,
      color: DOMAIN_COLORS[domain],
      size: domain === 0 ? 5 : 2.5 + Math.random() * 2,
      label: domainLabels[domain],
      domain,
    });
  }

  // --- Hyperedges: 같은 도메인 + cross-domain 연결 ---
  const edges: HyperEdge[] = [];

  // Same domain connections
  for (let d = 0; d < 13; d++) {
    const domainNodes = nodes.map((n, i) => ({ n, i })).filter(x => x.n.domain === d);
    for (let j = 0; j < domainNodes.length - 1; j++) {
      edges.push({
        nodes: [domainNodes[j].i, domainNodes[j + 1].i],
        color: DOMAIN_COLORS[d],
        alpha: 0.3,
      });
    }
  }

  // Cross-domain hyperedges (3-node connections)
  for (let i = 0; i < 8; i++) {
    const a = Math.floor(Math.random() * NODE_COUNT);
    let b = Math.floor(Math.random() * NODE_COUNT);
    let c = Math.floor(Math.random() * NODE_COUNT);
    while (b === a) b = Math.floor(Math.random() * NODE_COUNT);
    while (c === a || c === b) c = Math.floor(Math.random() * NODE_COUNT);
    edges.push({
      nodes: [a, b, c],
      color: [224, 231, 255],
      alpha: 0.15,
    });
  }

  // --- Mouse interaction ---
  let mouseX = 0, mouseY = 0, mouseActive = false;
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas!.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    mouseActive = true;
  });
  canvas.addEventListener('mouseleave', () => { mouseActive = false; });

  // --- 3D rotation ---
  let rotY = 0, rotX = 0.3;

  function project(x: number, y: number, z: number): { sx: number; sy: number; scale: number; depth: number } {
    // Rotate Y
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    let rx = x * cosY + z * sinY;
    const ry1 = y;
    let rz = -x * sinY + z * cosY;

    // Rotate X
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const ry = ry1 * cosX - rz * sinX;
    rz = ry1 * sinX + rz * cosX;

    // Perspective
    const fov = 500;
    const perspective = fov / (fov + rz + 200);
    const dW = displayW();
    const dH = displayH();

    return {
      sx: dW / 2 + rx * perspective,
      sy: dH / 2 + ry * perspective,
      scale: perspective,
      depth: rz,
    };
  }

  if (prefersReducedMotion) {
    // Static render
    drawFrame(0);
    return;
  }

  let frameId = 0;

  function drawFrame(time: number): void {
    const t = time * 0.001;
    const dW = displayW();
    const dH = displayH();
    ctx!.clearRect(0, 0, dW, dH);

    // Auto-rotate (slow)
    if (!mouseActive) {
      rotY = t * 0.15;
      rotX = 0.3 + Math.sin(t * 0.1) * 0.15;
    } else {
      // Mouse-driven rotation
      rotY += (mouseX / dW - 0.5) * 0.02;
      rotX += (mouseY / dH - 0.5) * 0.01;
    }

    // Node gentle drift
    for (const node of nodes) {
      node.x += Math.sin(t * 0.5 + node.domain) * 0.08;
      node.y += Math.cos(t * 0.3 + node.domain * 0.5) * 0.06;
      node.z += Math.sin(t * 0.4 + node.domain * 0.3) * 0.05;
    }

    // Project all nodes
    const projected = nodes.map((n, i) => ({ ...project(n.x, n.y, n.z), i, node: n }));

    // Draw edges (back to front)
    ctx!.globalCompositeOperation = 'lighter';

    for (const edge of edges) {
      const pts = edge.nodes.map(i => projected[i]);
      const avgDepth = pts.reduce((s, p) => s + p.depth, 0) / pts.length;
      const depthAlpha = Math.max(0.05, Math.min(1, (avgDepth + 200) / 400));

      const [r, g, b] = edge.color;

      if (edge.nodes.length === 2) {
        // Line edge
        ctx!.strokeStyle = `rgba(${r},${g},${b},${edge.alpha * depthAlpha})`;
        ctx!.lineWidth = 0.8 * depthAlpha;
        ctx!.beginPath();
        ctx!.moveTo(pts[0].sx, pts[0].sy);
        ctx!.lineTo(pts[1].sx, pts[1].sy);
        ctx!.stroke();
      } else {
        // Hyperedge — filled triangle
        ctx!.fillStyle = `rgba(${r},${g},${b},${edge.alpha * depthAlpha * 0.3})`;
        ctx!.beginPath();
        ctx!.moveTo(pts[0].sx, pts[0].sy);
        for (let j = 1; j < pts.length; j++) {
          ctx!.lineTo(pts[j].sx, pts[j].sy);
        }
        ctx!.closePath();
        ctx!.fill();
        // Edges of triangle
        ctx!.strokeStyle = `rgba(${r},${g},${b},${edge.alpha * depthAlpha * 0.5})`;
        ctx!.lineWidth = 0.5;
        ctx!.stroke();
      }
    }

    // Sort by depth (furthest first)
    projected.sort((a, b) => a.depth - b.depth);

    // Draw nodes
    for (const p of projected) {
      const { sx, sy, scale, node } = p;
      const depthAlpha = Math.max(0.2, Math.min(1, (p.depth + 200) / 400));
      const [r, g, b] = node.color;
      const sz = node.size * scale;

      // Glow
      const glowR = sz * 4;
      const grad = ctx!.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      grad.addColorStop(0, `rgba(${r},${g},${b},${0.6 * depthAlpha})`);
      grad.addColorStop(0.3, `rgba(${r},${g},${b},${0.2 * depthAlpha})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx!.fillStyle = grad;
      ctx!.beginPath();
      ctx!.arc(sx, sy, glowR, 0, TAU);
      ctx!.fill();

      // Core
      ctx!.fillStyle = `rgba(${r},${g},${b},${0.9 * depthAlpha})`;
      ctx!.beginPath();
      ctx!.arc(sx, sy, sz, 0, TAU);
      ctx!.fill();

      // White center
      ctx!.fillStyle = `rgba(255,255,255,${0.7 * depthAlpha})`;
      ctx!.beginPath();
      ctx!.arc(sx, sy, sz * 0.4, 0, TAU);
      ctx!.fill();
    }

    ctx!.globalCompositeOperation = 'source-over';
  }

  function animate(time: number): void {
    drawFrame(time);
    frameId = requestAnimationFrame(animate);
  }

  frameId = requestAnimationFrame(animate);

  // Cleanup
  document.addEventListener('astro:before-swap', () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
  }, { once: true });
}

// --- Bootstrap ---
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCHU);
  } else {
    initCHU();
  }
  document.addEventListener('astro:after-swap', initCHU);
}
