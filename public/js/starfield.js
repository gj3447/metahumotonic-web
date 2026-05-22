/**
 * MetaHumotonic — Canvas Starfield
 * # KG: TASK_Landing_Starfield, CONTRACT_Landing_Starfield
 *
 * Animated starfield with parallax depth layers, shooting stars,
 * and gentle Lissajous particle drift. Targets canvas#light-trails.
 * Falls back gracefully: if canvas missing or reduced-motion, does nothing.
 */
(function () {
  'use strict';

  // --- Configuration ---
  var STAR_COUNT = 240;
  var DEPTH_LAYERS = 4;
  var SHOOTING_STAR_INTERVAL_MIN = 3000;  // ms
  var SHOOTING_STAR_INTERVAL_MAX = 8000;  // ms
  var LISSAJOUS_AMP = 0.3;               // pixels per frame
  var LISSAJOUS_FREQ_X = 0.0007;
  var LISSAJOUS_FREQ_Y = 0.0011;

  // --- Reduced motion check ---
  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // F-FG-1 FIX: Signal ownership so main.js initLightTrails yields
  window.__starfieldActive = true;

  // --- Canvas setup ---
  var canvas = document.getElementById('light-trails');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var width, height;
  var stars = [];
  var shootingStars = [];
  var animationId = null;
  var time = 0;
  var nextShootingStarTime = 0;

  // --- Star class ---
  function Star() {
    this.reset();
  }

  Star.prototype.reset = function () {
    this.x = Math.random();           // 0..1 normalized
    this.y = Math.random();
    this.layer = Math.floor(Math.random() * DEPTH_LAYERS);
    this.baseSize = 0.5 + Math.random() * 1.5;
    this.size = this.baseSize * (1 + this.layer * 0.4);
    this.brightness = 0.3 + Math.random() * 0.7;
    this.twinkleSpeed = 0.5 + Math.random() * 2.0;
    this.twinkleOffset = Math.random() * Math.PI * 2;
    // Color temperature: mostly white, some warm, some cool
    var temp = Math.random();
    if (temp < 0.6) {
      this.r = 255; this.g = 255; this.b = 255;
    } else if (temp < 0.75) {
      this.r = 255; this.g = 228; this.b = 200;  // warm
    } else if (temp < 0.88) {
      this.r = 200; this.g = 220; this.b = 255;  // cool
    } else {
      this.r = 167; this.g = 139; this.b = 250;  // purple accent
    }
    // Parallax speed factor: deeper layers move slower
    this.parallaxFactor = 0.2 + (this.layer / DEPTH_LAYERS) * 0.8;
    // Lissajous phase offset
    this.lissPhaseX = Math.random() * Math.PI * 2;
    this.lissPhaseY = Math.random() * Math.PI * 2;
  };

  // --- Shooting star class ---
  function ShootingStar() {
    this.active = false;
  }

  ShootingStar.prototype.spawn = function () {
    this.active = true;
    this.x = Math.random() * 0.8 + 0.1;  // avoid edges
    this.y = Math.random() * 0.3;          // start upper portion
    this.angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2; // ~25-55 degrees
    this.speed = 0.003 + Math.random() * 0.004;
    this.length = 60 + Math.random() * 100;
    this.life = 1.0;
    this.decay = 0.012 + Math.random() * 0.01;
    this.thickness = 1 + Math.random() * 1.5;
  };

  ShootingStar.prototype.update = function () {
    if (!this.active) return;
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.life -= this.decay;
    if (this.life <= 0 || this.x > 1.2 || this.y > 1.2) {
      this.active = false;
    }
  };

  ShootingStar.prototype.draw = function (ctx, w, h) {
    if (!this.active) return;
    var px = this.x * w;
    var py = this.y * h;
    var tailX = px - Math.cos(this.angle) * this.length * this.life;
    var tailY = py - Math.sin(this.angle) * this.length * this.life;

    var grad = ctx.createLinearGradient(tailX, tailY, px, py);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.6, 'rgba(255, 255, 255, ' + (this.life * 0.3) + ')');
    grad.addColorStop(1, 'rgba(255, 255, 255, ' + (this.life * 0.8) + ')');

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(px, py);
    ctx.strokeStyle = grad;
    ctx.lineWidth = this.thickness * this.life;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Head glow
    ctx.beginPath();
    ctx.arc(px, py, 2 * this.life, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (this.life * 0.6) + ')';
    ctx.fill();
  };

  // --- Initialization ---
  function init() {
    resize();
    stars = [];
    for (var i = 0; i < STAR_COUNT; i++) {
      stars.push(new Star());
    }
    shootingStars = [];
    for (var j = 0; j < 3; j++) {
      shootingStars.push(new ShootingStar());
    }
    nextShootingStarTime = performance.now() + randomInterval();
  }

  function randomInterval() {
    return SHOOTING_STAR_INTERVAL_MIN + Math.random() * (SHOOTING_STAR_INTERVAL_MAX - SHOOTING_STAR_INTERVAL_MIN);
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  // --- Render loop ---
  function render(timestamp) {
    time = timestamp || 0;
    ctx.clearRect(0, 0, width, height);

    // Draw stars
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];

      // Lissajous drift
      var driftX = Math.sin(time * LISSAJOUS_FREQ_X + s.lissPhaseX) * LISSAJOUS_AMP * s.parallaxFactor;
      var driftY = Math.cos(time * LISSAJOUS_FREQ_Y + s.lissPhaseY) * LISSAJOUS_AMP * s.parallaxFactor;

      var px = s.x * width + driftX;
      var py = s.y * height + driftY;

      // Twinkle
      var twinkle = 0.5 + 0.5 * Math.sin(time * 0.001 * s.twinkleSpeed + s.twinkleOffset);
      var alpha = s.brightness * (0.4 + 0.6 * twinkle);

      // Draw
      ctx.beginPath();
      ctx.arc(px, py, s.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + s.r + ',' + s.g + ',' + s.b + ',' + alpha + ')';
      ctx.fill();

      // Glow for larger stars
      if (s.layer >= DEPTH_LAYERS - 1 && s.size > 1.5) {
        ctx.beginPath();
        ctx.arc(px, py, s.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + s.r + ',' + s.g + ',' + s.b + ',' + (alpha * 0.1) + ')';
        ctx.fill();
      }
    }

    // Shooting stars
    if (time >= nextShootingStarTime) {
      for (var j = 0; j < shootingStars.length; j++) {
        if (!shootingStars[j].active) {
          shootingStars[j].spawn();
          nextShootingStarTime = time + randomInterval();
          break;
        }
      }
    }

    for (var k = 0; k < shootingStars.length; k++) {
      shootingStars[k].update();
      shootingStars[k].draw(ctx, width, height);
    }

    animationId = requestAnimationFrame(render);
  }

  // --- Start / Stop ---
  function start() {
    if (prefersReducedMotion) return;
    if (animationId) return;
    init();
    animationId = requestAnimationFrame(render);
  }

  function stop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
    }
  }

  // --- Event listeners ---
  window.addEventListener('resize', function () {
    resize();
  });

  // Listen for reduced motion changes
  if (window.matchMedia) {
    var mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    var handler = function (e) {
      prefersReducedMotion = e.matches;
      if (prefersReducedMotion) {
        stop();
      } else {
        start();
      }
    };
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
    } else if (mql.addListener) {
      mql.addListener(handler);
    }
  }

  // --- Boot ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
