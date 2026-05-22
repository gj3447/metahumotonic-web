// KG: TASK_Landing_KGPreview, CONTRACT_Landing_KGPreview
// Interactive canvas-based Knowledge Graph visualization
// ~225 lines, force-directed layout, hover/click, reduced-motion support
(function () {
  'use strict';

  var DOMAINS = [
    { name: 'AI',             color: '#ff6b6b', weight: 18 },
    { name: 'SYM',            color: '#ffd93d', weight: 14 },
    { name: 'Reference',      color: '#6bcb77', weight: 8 },
    { name: 'CS',             color: '#4d96ff', weight: 10 },
    { name: 'Projects',       color: '#c084fc', weight: 9 },
    { name: 'Infrastructure', color: '#f472b6', weight: 7 },
    { name: 'Creative',       color: '#fb923c', weight: 5 },
    { name: 'APT',            color: '#22d3ee', weight: 6 },
    { name: 'Religion',       color: '#a78bfa', weight: 4 },
    { name: 'Community',      color: '#facc15', weight: 3 },
    { name: 'Streaming',      color: '#f87171', weight: 3 },
    { name: 'ICE',            color: '#38bdf8', weight: 4 },
    { name: 'Misc',           color: '#94a3b8', weight: 2 }
  ];

  var NODE_COUNT = 72;
  var EDGE_COUNT = 95;
  var nodes = [];
  var edges = [];
  var canvas, ctx, W, H;
  var hoveredNode = null;
  var animId = null;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = window.devicePixelRatio || 1;

  // Seeded random for deterministic layout
  var seed = 42;
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  function init() {
    canvas = document.getElementById('kg-preview');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    generateGraph();
    if (reducedMotion) {
      // Run physics settle then draw once
      for (var i = 0; i < 200; i++) physics();
      draw();
    } else {
      loop();
    }
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', onResize);
  }

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  var resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resize();
      if (reducedMotion) draw();
    }, 150);
  }

  function generateGraph() {
    nodes = [];
    edges = [];
    seed = 42;

    // Distribute nodes across domains proportional to weight
    var totalWeight = 0;
    for (var d = 0; d < DOMAINS.length; d++) totalWeight += DOMAINS[d].weight;

    var idx = 0;
    for (var di = 0; di < DOMAINS.length; di++) {
      var dom = DOMAINS[di];
      var count = Math.max(2, Math.round((dom.weight / totalWeight) * NODE_COUNT));
      // cluster center
      var cx = 0.15 + rand() * 0.7;
      var cy = 0.15 + rand() * 0.7;
      for (var ni = 0; ni < count && idx < NODE_COUNT; ni++) {
        nodes.push({
          x: (cx + (rand() - 0.5) * 0.25) * W,
          y: (cy + (rand() - 0.5) * 0.25) * H,
          vx: 0, vy: 0,
          r: 3 + dom.weight * 0.3 + rand() * 2,
          color: dom.color,
          domain: dom.name,
          label: dom.name + ' ' + (ni + 1),
          domainIdx: di
        });
        idx++;
      }
    }

    // Edges: intra-domain + inter-domain
    var edgeSet = {};
    function addEdge(a, b) {
      if (a === b) return;
      var key = Math.min(a, b) + '-' + Math.max(a, b);
      if (edgeSet[key]) return;
      edgeSet[key] = true;
      edges.push({ a: a, b: b });
    }

    // Intra-domain: chain within each domain cluster
    var domStart = 0;
    for (var dj = 0; dj < DOMAINS.length; dj++) {
      var domNodes = [];
      for (var k = 0; k < nodes.length; k++) {
        if (nodes[k].domainIdx === dj) domNodes.push(k);
      }
      for (var m = 1; m < domNodes.length; m++) {
        addEdge(domNodes[m - 1], domNodes[m]);
      }
    }

    // Inter-domain: random cross-links
    while (edges.length < EDGE_COUNT) {
      var a = Math.floor(rand() * nodes.length);
      var b = Math.floor(rand() * nodes.length);
      addEdge(a, b);
    }
  }

  function physics() {
    var N = nodes.length;
    var repulse = 1200;
    var attract = 0.005;
    var damping = 0.92;
    var centerPull = 0.0003;

    // Repulsion between all pairs
    for (var i = 0; i < N; i++) {
      for (var j = i + 1; j < N; j++) {
        var dx = nodes[i].x - nodes[j].x;
        var dy = nodes[i].y - nodes[j].y;
        var dist2 = dx * dx + dy * dy + 1;
        var f = repulse / dist2;
        var fx = dx * f;
        var fy = dy * f;
        nodes[i].vx += fx;
        nodes[i].vy += fy;
        nodes[j].vx -= fx;
        nodes[j].vy -= fy;
      }
    }

    // Attraction along edges
    for (var e = 0; e < edges.length; e++) {
      var na = nodes[edges[e].a];
      var nb = nodes[edges[e].b];
      var edx = nb.x - na.x;
      var edy = nb.y - na.y;
      var ef = attract;
      na.vx += edx * ef;
      na.vy += edy * ef;
      nb.vx -= edx * ef;
      nb.vy -= edy * ef;
    }

    // Center pull + damping + integrate
    for (var p = 0; p < N; p++) {
      var n = nodes[p];
      n.vx += (W * 0.5 - n.x) * centerPull;
      n.vy += (H * 0.5 - n.y) * centerPull;
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;

      // Gentle drift for living feel
      if (!reducedMotion) {
        n.x += Math.sin(Date.now() * 0.0003 + p) * 0.08;
        n.y += Math.cos(Date.now() * 0.0004 + p * 1.3) * 0.06;
      }

      // Bounds
      var pad = n.r + 4;
      if (n.x < pad) { n.x = pad; n.vx *= -0.5; }
      if (n.x > W - pad) { n.x = W - pad; n.vx *= -0.5; }
      if (n.y < pad) { n.y = pad; n.vy *= -0.5; }
      if (n.y > H - pad) { n.y = H - pad; n.vy *= -0.5; }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Connected set for hovered node
    var connSet = null;
    if (hoveredNode !== null) {
      connSet = {};
      connSet[hoveredNode] = true;
      for (var e2 = 0; e2 < edges.length; e2++) {
        if (edges[e2].a === hoveredNode) connSet[edges[e2].b] = true;
        if (edges[e2].b === hoveredNode) connSet[edges[e2].a] = true;
      }
    }

    // Draw edges
    for (var e = 0; e < edges.length; e++) {
      var ea = edges[e].a, eb = edges[e].b;
      var na = nodes[ea], nb = nodes[eb];
      var highlighted = connSet && (connSet[ea] && connSet[eb]);
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.strokeStyle = highlighted
        ? 'rgba(255,255,255,0.35)'
        : 'rgba(120,130,200,0.08)';
      ctx.lineWidth = highlighted ? 1.5 : 0.5;
      ctx.stroke();
    }

    // Draw nodes
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var isHovered = i === hoveredNode;
      var isConnected = connSet && connSet[i];
      var alpha = connSet ? (isConnected ? 1 : 0.15) : 0.7;

      ctx.beginPath();
      ctx.arc(n.x, n.y, isHovered ? n.r + 3 : n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.globalAlpha = alpha;
      ctx.fill();

      // Glow for hovered
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 8, 0, Math.PI * 2);
        var grad = ctx.createRadialGradient(n.x, n.y, n.r, n.x, n.y, n.r + 8);
        grad.addColorStop(0, n.color + '66');
        grad.addColorStop(1, n.color + '00');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 1;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }

    // Label for hovered node
    if (hoveredNode !== null) {
      var hn = nodes[hoveredNode];
      ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(hn.domain, hn.x, hn.y - hn.r - 10);
    }
  }

  function loop() {
    physics();
    draw();
    animId = requestAnimationFrame(loop);
  }

  function getNodeAt(mx, my) {
    for (var i = nodes.length - 1; i >= 0; i--) {
      var dx = nodes[i].x - mx;
      var dy = nodes[i].y - my;
      if (dx * dx + dy * dy < (nodes[i].r + 4) * (nodes[i].r + 4)) return i;
    }
    return null;
  }

  function getMousePos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onMouseMove(e) {
    var pos = getMousePos(e);
    var prev = hoveredNode;
    hoveredNode = getNodeAt(pos.x, pos.y);
    canvas.style.cursor = hoveredNode !== null ? 'pointer' : 'default';
    if (reducedMotion && hoveredNode !== prev) draw();
  }

  function onMouseLeave() {
    hoveredNode = null;
    canvas.style.cursor = 'default';
    if (reducedMotion) draw();
  }

  function onClick(e) {
    if (hoveredNode === null) return;
    var dom = nodes[hoveredNode].domain.toLowerCase();
    var target = document.getElementById('domains');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
