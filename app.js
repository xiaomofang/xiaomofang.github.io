(function () {
  const THEME_KEY = "yichuan-theme";

  const STAR_GLYPHS = ["✦", "✧", "★", "⭐", "✨", "⋆"];
  const STAR_COLORS = [
    "#fde68a", "#f9a8d4", "#67e8f9", "#c4b5fd", "#fdba74",
    "#86efac", "#fda4af", "#a5b4fc", "#fcd34d", "#e879f9",
  ];

  let currentCategory = "all";
  let searchQuery = "";

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersNight = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersNight ? "night" : "day");
    document.documentElement.setAttribute("data-theme", theme);
    updateToggleLabel(theme);
  }

  function updateToggleLabel(theme) {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.setAttribute("aria-label", theme === "night" ? "Switch to day" : "Switch to night");
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "night" ? "day" : "night";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    updateToggleLabel(next);
  }

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function initStars() {
    const canvas = document.getElementById("star-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const particles = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    document.addEventListener("click", function (e) {
      if (e.target.closest("a, button, input, textarea, .theme-toggle, .tag-pill")) {
        return;
      }

      const burst = 4 + Math.floor(Math.random() * 6);
      const angleBase = Math.random() * Math.PI * 2;

      for (let i = 0; i < burst; i++) {
        const angle = angleBase + (Math.random() - 0.5) * 1.8;
        const speed = 1.2 + Math.random() * 3.5;
        particles.push({
          x: e.clientX + (Math.random() - 0.5) * 16,
          y: e.clientY + (Math.random() - 0.5) * 16,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (1 + Math.random() * 2),
          size: 10 + Math.random() * 18,
          glyph: randomFrom(STAR_GLYPHS),
          color: randomFrom(STAR_COLORS),
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.18,
          life: 1,
          decay: 0.012 + Math.random() * 0.018,
          gravity: 0.02 + Math.random() * 0.03,
        });
      }
    });

    function drawParticle(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8 * p.life;
      ctx.font = p.size + "px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.glyph, 0, 0);
      ctx.restore();
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= p.decay;
        p.vx *= 0.98;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;

        if (p.life <= 0) {
          particles.splice(i, 1);
        } else {
          drawParticle(p);
        }
      }
      requestAnimationFrame(animate);
    }

    animate();
  }

  function filterPosts() {
    const cards = Array.from(document.querySelectorAll(".post-card[data-category]"));
    const list = document.getElementById("post-list");
    const empty = document.getElementById("empty-state");
    if (!list) return;

    const q = searchQuery.toLowerCase().trim();
    const visible = cards.filter((card) => {
      const catMatch = currentCategory === "all" || card.dataset.category === currentCategory;
      if (!catMatch) return false;
      if (!q) return true;
      const title = (card.dataset.title || "").toLowerCase();
      const excerpt = (card.querySelector(".post-excerpt")?.textContent || "").toLowerCase();
      return title.includes(q) || excerpt.includes(q);
    });

    visible.sort((a, b) => (b.dataset.date || "").localeCompare(a.dataset.date || ""));

    cards.forEach((c) => c.classList.add("hidden"));
    visible.forEach((c) => {
      c.classList.remove("hidden");
      list.appendChild(c);
    });

    if (empty) empty.classList.toggle("hidden", visible.length > 0);
  }

  function initFilters() {
    document.querySelectorAll(".tag-pill").forEach((pill) => {
      pill.addEventListener("click", function () {
        currentCategory = pill.dataset.category;
        document.querySelectorAll(".tag-pill").forEach((p) => {
          p.classList.toggle("active", p === pill);
        });
        filterPosts();
      });
    });

    const search = document.getElementById("search-input");
    if (search) {
      search.addEventListener("input", function () {
        searchQuery = search.value;
        filterPosts();
      });
    }
  }

  function initYear() {
    const el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initStars();
    initFilters();
    initYear();
    filterPosts();

    const toggle = document.getElementById("theme-toggle");
    if (toggle) toggle.addEventListener("click", toggleTheme);
  });
})();
