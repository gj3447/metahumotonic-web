/**
 * MetaHumotonic Landing — main.js
 * KG: CONTRACT_Landing_CountersScroll, CONTRACT_Landing_KGPreview
 *
 * Progressive Enhancement: HTML is fully readable without JS.
 * All features here are additive enhancements only.
 */

(function () {
  "use strict";

  /* ==========================================================================
     Cosmic Light Trails — 수학적 빛의 궤적 (리사주 곡선 + 오비탈)
     4개 빛의 입자가 리사주 곡선을 따라 움직이며 잔상(trail)을 남긴다.
     마스코트의 4색(핑크/시안/퍼플/화이트)을 반영.
     ========================================================================== */

  function initLightTrails() {
    // F-FG-1 FIX: starfield.js now owns canvas#light-trails. Skip if starfield active.
    // # KG: CONTRACT_Landing_Starfield supersedes this function
    if (window.__starfieldActive) return;
    const canvas = document.getElementById("light-trails");
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    let w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // 4개 빛의 입자 — 리사주 곡선 파라미터
    const particles = [
      { freqX: 3, freqY: 2, phase: 0,        color: "244,114,182", radius: 3 },  // 핑크
      { freqX: 5, freqY: 4, phase: Math.PI/4, color: "103,232,249", radius: 2.5 }, // 시안
      { freqX: 3, freqY: 4, phase: Math.PI/2, color: "167,139,250", radius: 3 },  // 퍼플
      { freqX: 5, freqY: 6, phase: Math.PI,   color: "224,231,255", radius: 2 },  // 화이트
    ];

    // 각 입자의 트레일 히스토리
    const trails = particles.map(() => []);
    const TRAIL_LENGTH = 80;

    let t = 0;

    function animate() {
      // 반투명 검은색으로 페이드 (잔상 효과)
      ctx.fillStyle = "rgba(5, 10, 24, 0.08)";
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h * 0.4; // 화면 상단 40% 중심
      const ampX = Math.min(w * 0.35, 350);
      const ampY = Math.min(h * 0.25, 200);

      particles.forEach((p, i) => {
        // 리사주 곡선: x = A*sin(a*t + phase), y = B*sin(b*t)
        const x = cx + ampX * Math.sin(p.freqX * t + p.phase);
        const y = cy + ampY * Math.sin(p.freqY * t);

        // 트레일 저장
        trails[i].push({ x, y });
        if (trails[i].length > TRAIL_LENGTH) trails[i].shift();

        // 트레일 그리기 (점점 밝아지는 선)
        if (trails[i].length > 2) {
          ctx.beginPath();
          ctx.moveTo(trails[i][0].x, trails[i][0].y);
          for (let j = 1; j < trails[i].length; j++) {
            ctx.lineTo(trails[i][j].x, trails[i][j].y);
          }
          const alpha = 0.3;
          ctx.strokeStyle = `rgba(${p.color}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // 빛나는 점 (현재 위치)
        ctx.beginPath();
        ctx.arc(x, y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, 0.9)`;
        ctx.fill();

        // 글로우 효과
        ctx.beginPath();
        ctx.arc(x, y, p.radius * 4, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, p.radius * 4);
        grad.addColorStop(0, `rgba(${p.color}, 0.3)`);
        grad.addColorStop(1, `rgba(${p.color}, 0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      t += 0.008; // 속도
      requestAnimationFrame(animate);
    }

    animate();
  }

  // DOM Ready 후 초기화
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLightTrails);
  } else {
    initLightTrails();
  }

  /* ==========================================================================
     CONTRACT_Landing_CountersScroll — Counter Animation
     Uses IntersectionObserver to detect .counter elements, reads data-count,
     and animates with easeOutExpo via requestAnimationFrame (2s duration).
     ========================================================================== */

  /**
   * easeOutExpo: fast start, slow finish.
   * @param {number} t - Progress 0..1
   * @returns {number} Eased value 0..1
   */
  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  /**
   * Animate a single counter element from 0 to its data-count value.
   * @param {HTMLElement} el - Element with data-count attribute
   */
  function animateCounter(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (isNaN(target) || target <= 0) {
      return;
    }

    var suffix = el.getAttribute("data-suffix") || "";
    var duration = 2000; // 2 seconds
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var easedProgress = easeOutExpo(progress);
      var current = Math.round(easedProgress * target);

      el.textContent = formatNumber(current) + suffix;

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  /**
   * Format number with locale-appropriate separators (e.g. 548000 -> "548,000").
   * @param {number} n
   * @returns {string}
   */
  function formatNumber(n) {
    try {
      return n.toLocaleString("en-US");
    } catch (e) {
      return String(n);
    }
  }

  /* ==========================================================================
     CONTRACT_Landing_CountersScroll — Scroll Fade-In
     Adds .visible class to .fade-in elements when they enter the viewport.
     ========================================================================== */

  function initScrollObservers() {
    if (!("IntersectionObserver" in window)) {
      // Fallback: show everything immediately
      document.querySelectorAll(".fade-in").forEach(function (el) {
        el.classList.add("visible");
      });
      document.querySelectorAll(".counter").forEach(function (el) {
        var target = parseInt(el.getAttribute("data-count"), 10);
        var suffix = el.getAttribute("data-suffix") || "";
        if (!isNaN(target)) {
          el.textContent = formatNumber(target) + suffix;
        }
      });
      return;
    }

    // Fade-in observer
    var fadeObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            fadeObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll(".fade-in").forEach(function (el) {
      fadeObserver.observe(el);
    });

    // Counter observer — animate once when visible
    var counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );

    document.querySelectorAll(".counter").forEach(function (el) {
      counterObserver.observe(el);
    });
  }

  /* ==========================================================================
     CONTRACT_Landing_KGPreview — Donut Chart (CSS conic-gradient)
     Renders domain distribution as a donut chart using conic-gradient.
     Domain click toggles detail panel.
     ========================================================================== */

  /**
   * Default KG domain data. Can be overridden by setting
   * window.MH_KG_DOMAINS before this script loads.
   */
  var KG_DOMAINS = window.MH_KG_DOMAINS || [
    { name: "SymConcept",     count: 6181, color: "#22c55e" },
    { name: "Mathematics",    count: 5346, color: "#3b82f6" },
    { name: "Concept",        count: 4108, color: "#a855f7" },
    { name: "KnowledgeNode",  count: 2844, color: "#f59e0b" },
    { name: "AbstractNode",   count: 1200, color: "#ef4444" },
    { name: "Other",          count: 27730, color: "#6b7280" }
  ];

  /**
   * Build conic-gradient string from domain data.
   * @param {Array} domains - Array of {name, count, color}
   * @returns {string} CSS conic-gradient value
   */
  function buildConicGradient(domains) {
    var total = domains.reduce(function (sum, d) { return sum + d.count; }, 0);
    if (total === 0) return "none";

    var segments = [];
    var cumulative = 0;

    domains.forEach(function (d) {
      var start = cumulative;
      var end = cumulative + (d.count / total) * 360;
      segments.push(d.color + " " + start.toFixed(1) + "deg " + end.toFixed(1) + "deg");
      cumulative = end;
    });

    return "conic-gradient(" + segments.join(", ") + ")";
  }

  /**
   * Initialize the KG preview donut chart if .kg-donut exists.
   */
  function initKGPreview() {
    var donut = document.querySelector(".kg-donut");
    if (!donut) return;

    // Apply conic-gradient
    donut.style.background = buildConicGradient(KG_DOMAINS);

    // Build legend
    var legend = document.querySelector(".kg-legend");
    if (legend) {
      var total = KG_DOMAINS.reduce(function (s, d) { return s + d.count; }, 0);

      KG_DOMAINS.forEach(function (d, i) {
        var pct = ((d.count / total) * 100).toFixed(1);
        var li = document.createElement("li");
        li.setAttribute("role", "button");
        li.setAttribute("tabindex", "0");
        li.setAttribute("aria-expanded", "false");
        li.setAttribute("data-domain-index", String(i));
        li.className = "cursor-pointer text-sm text-gray-400 hover:text-white transition";
        li.innerHTML =
          '<span class="kg-legend__swatch" style="background:' + d.color + '"></span>' +
          d.name + ' <span class="text-gray-600">(' + pct + '%)</span>';

        li.addEventListener("click", function () { toggleDomainDetail(i); });
        li.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleDomainDetail(i);
          }
        });

        legend.appendChild(li);
      });
    }
  }

  /**
   * Toggle detail panel for a domain.
   * @param {number} index - Domain index in KG_DOMAINS
   */
  function toggleDomainDetail(index) {
    var detail = document.querySelector(".kg-domain-detail");
    if (!detail) return;

    var d = KG_DOMAINS[index];
    var total = KG_DOMAINS.reduce(function (s, dm) { return s + dm.count; }, 0);
    var pct = ((d.count / total) * 100).toFixed(1);
    var isOpen = detail.classList.contains("is-open") &&
                 detail.getAttribute("data-active") === String(index);

    // Update legend aria-expanded
    document.querySelectorAll(".kg-legend [data-domain-index]").forEach(function (li) {
      li.setAttribute("aria-expanded", "false");
    });

    if (isOpen) {
      detail.classList.remove("is-open");
      detail.removeAttribute("data-active");
      return;
    }

    var li = document.querySelector('.kg-legend [data-domain-index="' + index + '"]');
    if (li) li.setAttribute("aria-expanded", "true");

    detail.setAttribute("data-active", String(index));
    detail.innerHTML =
      '<strong style="color:' + d.color + '">' + d.name + '</strong>' +
      '<span class="text-gray-500"> &mdash; ' + formatNumber(d.count) + ' nodes (' + pct + '%)</span>';
    detail.classList.add("is-open");
  }

  /* ==========================================================================
     CONTRACT_Landing_Starfield — Generate Star Elements
     Programmatically creates .star elements inside .starfield-bg.
     ========================================================================== */

  function initStarfield() {
    var container = document.querySelector(".starfield-bg");
    if (!container) return;

    // Respect reduced motion
    var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var starCount = prefersReduced ? 40 : 120;
    var sizes = ["star--xs", "star--sm", "star--md", "star--lg"];
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < starCount; i++) {
      var star = document.createElement("div");
      star.className = "star " + sizes[Math.floor(Math.random() * sizes.length)];
      star.style.left = (Math.random() * 100).toFixed(2) + "%";
      star.style.top = (Math.random() * 100).toFixed(2) + "%";
      star.style.setProperty("--star-duration", (3 + Math.random() * 5).toFixed(1) + "s");
      star.style.setProperty("--star-delay", (Math.random() * 6).toFixed(1) + "s");
      fragment.appendChild(star);
    }

    container.appendChild(fragment);
  }

  /* ==========================================================================
     Init — DOMContentLoaded
     ========================================================================== */

  function init() {
    initStarfield();
    initScrollObservers();
    initKGPreview();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
