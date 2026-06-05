(function () {
  const THEME_KEY = "yichuan-theme";

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

  function initStars() {
    const canvas = document.getElementById("star-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const stars = [];

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

      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: e.clientX + (Math.random() - 0.5) * 30,
          y: e.clientY + (Math.random() - 0.5) * 30,
          size: 10 + Math.random() * 14,
          rotation: Math.random() * Math.PI * 2,
          life: 1,
          decay: 0.045 + Math.random() * 0.025,
          driftX: (Math.random() - 0.5) * 1.2,
          driftY: -1.2 - Math.random() * 1.5,
        });
      }
    });

    function drawStar(x, y, size, rotation, alpha) {
      const theme = document.documentElement.getAttribute("data-theme");
      const color = theme === "night" ? "#ffe9a0" : "#e8a830";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.font = size + "px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✦", 0, 0);
      ctx.restore();
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.life -= s.decay;
        s.x += s.driftX;
        s.y += s.driftY;
        s.rotation += 0.04;
        if (s.life <= 0) {
          stars.splice(i, 1);
        } else {
          drawStar(s.x, s.y, s.size, s.rotation, s.life);
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
