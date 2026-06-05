(function () {
  const THEME_KEY = "yichuan-theme";
  const GUESTBOOK_KEY = "yichuan-guestbook";

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
    btn.setAttribute("aria-label", theme === "night" ? "切换为白天" : "切换为黑夜");
    btn.title = theme === "night" ? "切换为白天 ☀️" : "切换为黑夜 🌙";
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
      if (
        e.target.closest("a, button, input, textarea, .theme-toggle, .category-tab, .guestbook-submit")
      ) {
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
          decay: 0.018 + Math.random() * 0.012,
          driftX: (Math.random() - 0.5) * 1.2,
          driftY: -0.8 - Math.random() * 1.5,
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

  function formatTime(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  }

  function loadGuestbook() {
    try {
      return JSON.parse(localStorage.getItem(GUESTBOOK_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveGuestbook(items) {
    localStorage.setItem(GUESTBOOK_KEY, JSON.stringify(items));
  }

  function renderGuestbook() {
    const list = document.getElementById("guestbook-list");
    if (!list) return;

    const items = loadGuestbook();
    if (items.length === 0) {
      list.innerHTML = '<p class="guestbook-empty">还没有留言，写下第一条吧 ✦</p>';
      return;
    }

    list.innerHTML = items
      .slice()
      .reverse()
      .map(
        (item) =>
          '<div class="guestbook-item">' +
          '<div class="guestbook-item-header">' +
          '<span class="guestbook-item-name">' +
          escapeHtml(item.name) +
          "</span>" +
          '<span class="guestbook-item-time">' +
          formatTime(item.time) +
          "</span>" +
          "</div>" +
          '<p class="guestbook-item-text">' +
          escapeHtml(item.text) +
          "</p>" +
          "</div>"
      )
      .join("");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function initGuestbook() {
    const form = document.getElementById("guestbook-form");
    if (!form) return;

    renderGuestbook();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const nameInput = document.getElementById("guest-name");
      const textInput = document.getElementById("guest-text");
      const name = (nameInput.value || "访客").trim().slice(0, 20);
      const text = textInput.value.trim().slice(0, 500);

      if (!text) return;

      const items = loadGuestbook();
      items.push({ name, text, time: Date.now() });
      saveGuestbook(items);

      nameInput.value = "";
      textInput.value = "";
      renderGuestbook();
    });
  }

  function initCategoryFilter() {
    const tabs = document.querySelectorAll(".category-tab");
    const cards = document.querySelectorAll(".post-card[data-category]");
    if (!tabs.length || !cards.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        const cat = tab.dataset.category;
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        cards.forEach((card) => {
          const match = cat === "all" || card.dataset.category === cat;
          card.classList.toggle("hidden", !match);
        });
      });
    });
  }

  function initYear() {
    const el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initStars();
    initGuestbook();
    initCategoryFilter();
    initYear();

    const toggle = document.getElementById("theme-toggle");
    if (toggle) toggle.addEventListener("click", toggleTheme);
  });
})();
