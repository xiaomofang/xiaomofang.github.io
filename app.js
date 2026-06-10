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
    updateUtterancesTheme(next);
  }

  function initStars() {
    const canvas = document.getElementById("star-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const sparks = [];
    const mascotSrc = document.body.dataset.mascot || "assets/tiger-catstyle-bw-lines.png";
    const mascotImg = new Image();
    let mascotReady = false;

    mascotImg.onload = function () {
      mascotReady = true;
    };
    mascotImg.src = mascotSrc;

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

      const FADE_MS = 1500;
      const count = 2 + Math.floor(Math.random() * 2);
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        sparks.push({
          x: e.clientX + (Math.random() - 0.5) * 36,
          y: e.clientY + (Math.random() - 0.5) * 36,
          size: 30 + Math.random() * 16,
          rotation: (Math.random() - 0.5) * 0.5,
          born: now,
          fadeMs: FADE_MS,
          driftX: (Math.random() - 0.5) * 0.8,
          driftY: -0.8 - Math.random() * 1.0,
        });
      }
    });

    function drawSpark(x, y, size, rotation, alpha) {
      if (!mascotReady) return;

      const theme = document.documentElement.getAttribute("data-theme");
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = alpha;

      if (theme === "night") {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.58, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, " + alpha * 0.96 + ")";
        ctx.fill();
      }

      ctx.drawImage(mascotImg, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    function animate(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        const life = 1 - (now - s.born) / s.fadeMs;
        s.x += s.driftX;
        s.y += s.driftY;
        if (life <= 0) {
          sparks.splice(i, 1);
        } else {
          drawSpark(s.x, s.y, s.size, s.rotation, life);
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
      const categories = (card.dataset.category || "").split(/\s+/);
      const catMatch = currentCategory === "all" || categories.includes(currentCategory);
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

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlightPython(code) {
    const tokenPattern = /(#.*$)|("[^"\n]*"|'[^'\n]*')|\b(\d+(?:\.\d+)?)\b|\b(from|import|for|in|if|else|elif|return|def|class|with|as|try|except|finally|while|break|continue|pass|True|False|None)\b/gm;
    let html = "";
    let lastIndex = 0;

    code.replace(tokenPattern, function (match, comment, string, number, keyword, offset) {
      html += escapeHtml(code.slice(lastIndex, offset));
      const className = comment
        ? "token-comment"
        : string
          ? "token-string"
          : number
            ? "token-number"
            : "token-keyword";
      html += '<span class="' + className + '">' + escapeHtml(match) + "</span>";
      lastIndex = offset + match.length;
      return match;
    });

    return html + escapeHtml(code.slice(lastIndex));
  }

  function initCodeHighlighting() {
    document.querySelectorAll("code.language-python").forEach((block) => {
      block.innerHTML = highlightPython(block.textContent || "");
    });
  }

  function getUtterancesTheme(theme) {
    return theme === "night" ? "github-dark" : "github-light";
  }

  function initComments() {
    const container = document.getElementById("utterances-container");
    if (!container) return;

    const theme = document.documentElement.getAttribute("data-theme") || "night";
    const script = document.createElement("script");
    script.src = "https://utteranc.es/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("repo", "xiaomofang/xiaomofang.github.io");
    script.setAttribute("issue-term", "pathname");
    script.setAttribute("label", "comment");
    script.setAttribute("theme", getUtterancesTheme(theme));
    container.appendChild(script);
  }

  function updateUtterancesTheme(theme) {
    const iframe = document.querySelector(".utterances-frame");
    if (!iframe) return;
    iframe.contentWindow.postMessage(
      {
        type: "set-theme",
        theme: getUtterancesTheme(theme),
      },
      "https://utteranc.es"
    );
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initStars();
    initFilters();
    initYear();
    initCodeHighlighting();
    initComments();
    filterPosts();

    const toggle = document.getElementById("theme-toggle");
    if (toggle) toggle.addEventListener("click", toggleTheme);
  });
})();
