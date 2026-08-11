(function () {
  const THEME_KEY = "yichuan-theme";

  let currentCategory = "all";
  let currentKeyword = "all";
  let searchQuery = "";

  const KEYWORD_LABELS = {
    speculative: "投机推理",
    attention: "Attention 加速",
    "inference-systems": "推理框架",
    training: "训练",
    "llm-gateway": "LLM Gateway",
    determinism: "确定性",
    hardware: "硬件与 Kernel",
  };

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
    const stars = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    document.addEventListener("click", function (e) {
      if (e.target.closest("a, button, input, textarea, .theme-toggle, .tag-pill, .keyword-pill, .post-keyword-chip")) {
        return;
      }

      const FADE_MS = 1400;
      const count = 3 + Math.floor(Math.random() * 3);
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        stars.push({
          x: e.clientX + (Math.random() - 0.5) * 30,
          y: e.clientY + (Math.random() - 0.5) * 30,
          size: 16 + Math.random() * 14,
          rotation: Math.random() * Math.PI * 2,
          born: now,
          fadeMs: FADE_MS,
          driftX: (Math.random() - 0.5) * 1.0,
          driftY: -0.7 - Math.random() * 1.2,
        });
      }
      ensureAnimate();
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

    let animating = false;

    function animate(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        const life = 1 - (now - s.born) / s.fadeMs;
        s.x += s.driftX;
        s.y += s.driftY;
        s.rotation += 0.02;
        if (life <= 0) {
          stars.splice(i, 1);
        } else {
          drawStar(s.x, s.y, s.size, s.rotation, life);
        }
      }

      if (stars.length > 0) {
        requestAnimationFrame(animate);
      } else {
        animating = false;
      }
    }

    function ensureAnimate() {
      if (!animating) {
        animating = true;
        requestAnimationFrame(animate);
      }
    }
  }

  function setKeyword(keyword, syncUrl) {
    currentKeyword = keyword || "all";
    document.querySelectorAll(".keyword-pill").forEach((p) => {
      p.classList.toggle("active", (p.dataset.keyword || "all") === currentKeyword);
    });
    if (syncUrl !== false) {
      const url = new URL(window.location.href);
      if (currentKeyword === "all") {
        url.searchParams.delete("keyword");
      } else {
        url.searchParams.set("keyword", currentKeyword);
      }
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }

  function filterPosts() {
    const cards = Array.from(document.querySelectorAll(".post-card[data-category]"));
    const list = document.getElementById("post-list");
    const empty = document.getElementById("empty-state");
    if (!list) return;

    const q = searchQuery.toLowerCase().trim();
    const visible = cards.filter((card) => {
      const categories = (card.dataset.category || "").split(/\s+/).filter(Boolean);
      const keywords = (card.dataset.keywords || "").split(/\s+/).filter(Boolean);
      const catMatch = currentCategory === "all" || categories.includes(currentCategory);
      if (!catMatch) return false;
      const kwMatch = currentKeyword === "all" || keywords.includes(currentKeyword);
      if (!kwMatch) return false;
      if (!q) return true;
      const title = (card.dataset.title || "").toLowerCase();
      const excerpt = (card.querySelector(".post-excerpt")?.textContent || "").toLowerCase();
      const keywordText = keywords
        .map((k) => KEYWORD_LABELS[k] || k)
        .join(" ")
        .toLowerCase();
      return title.includes(q) || excerpt.includes(q) || keywordText.includes(q);
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

    document.querySelectorAll(".keyword-pill").forEach((pill) => {
      pill.addEventListener("click", function () {
        setKeyword(pill.dataset.keyword || "all");
        filterPosts();
      });
    });

    document.querySelectorAll(".post-keyword-chip[data-keyword]").forEach((chip) => {
      chip.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        setKeyword(chip.dataset.keyword || "all");
        filterPosts();
        const cloud = document.getElementById("keywords");
        if (cloud) cloud.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("keyword");
    if (fromUrl && (fromUrl === "all" || KEYWORD_LABELS[fromUrl])) {
      setKeyword(fromUrl, false);
    }

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

  // Chinese reading pace used for 预计阅读时间 (~300 字 / min).
  const CHARS_PER_MINUTE = 300;

  function formatZhDate(isoDate) {
    const parts = String(isoDate || "").split("-").map(Number);
    if (parts.length < 3 || parts.some((n) => !n)) return isoDate || "";
    const [y, m, d] = parts;
    return y + "年" + m + "月" + d + "日";
  }

  function countReadableChars(root) {
    if (!root) return 0;
    const clone = root.cloneNode(true);
    clone.querySelectorAll("pre, code, .katex, .katex-display, script, style, noscript").forEach(function (el) {
      el.remove();
    });
    const text = clone.textContent || "";
    const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const latinWords = (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []).length;
    return cjk + latinWords;
  }

  function formatReadingMeta(isoDate, chars, author) {
    const minutes = Math.max(1, Math.ceil(chars / CHARS_PER_MINUTE));
    return formatZhDate(isoDate) + " · " + minutes + " 分钟 · " + chars + " 字 · " + (author || "MOFANG");
  }

  function initReadingStats() {
    const meta = document.querySelector(".post-page-meta[data-date]");
    const content = document.querySelector(".post-page-content");
    if (!meta || !content) return;

    const chars = countReadableChars(content);
    meta.textContent = formatReadingMeta(
      meta.getAttribute("data-date"),
      chars,
      meta.getAttribute("data-author") || "MOFANG"
    );
    meta.setAttribute("data-chars", String(chars));
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
    initReadingStats();
    initComments();
    filterPosts();

    const toggle = document.getElementById("theme-toggle");
    if (toggle) toggle.addEventListener("click", toggleTheme);
  });
})();
