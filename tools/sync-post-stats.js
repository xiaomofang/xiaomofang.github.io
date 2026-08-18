const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(ROOT, "index.html");
const CHARS_PER_MINUTE = 300;

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function formatZhDate(isoDate) {
  const parts = String(isoDate || "").split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => !n)) return isoDate || "";
  const [year, month, day] = parts;
  return `${year}年${month}月${day}日`;
}

function stripIgnoredContent(html) {
  return html
    .replace(/<pre\b[\s\S]*?<\/pre>/gi, " ")
    .replace(/<code\b[\s\S]*?<\/code>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");
}

function stripMathSource(html) {
  // app.js counts after KaTeX has rendered, then removes .katex/.katex-display.
  // Match that runtime behavior by removing raw TeX delimiters from source HTML.
  return html
    .replace(/\\\[[\s\S]*?\\\]/g, " ")
    .replace(/\\\([\s\S]*?\\\)/g, " ");
}

function extractPostContent(html) {
  const start = html.indexOf('<section class="post-page-content">');
  if (start === -1) return "";
  const end = html.indexOf('<section class="comments-section"', start);
  return html.slice(start, end === -1 ? html.length : end);
}

function countReadableChars(html) {
  const content = stripMathSource(stripIgnoredContent(extractPostContent(html)));
  const text = decodeEntities(content.replace(/<[^>]+>/g, " "));
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latinWords = (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []).length;
  return cjk + latinWords;
}

function readMeta(html) {
  const meta = html.match(/<p class="post-page-meta"\s+([^>]*)>/);
  if (!meta) return null;
  const attrs = meta[1];
  const get = (name) => {
    const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
    return match ? match[1] : "";
  };
  return {
    date: get("data-date"),
    author: get("data-author") || "MOFANG",
    minutes: get("data-minutes"),
  };
}

function postStatsForHref(href) {
  const postPath = path.join(ROOT, href.replace(/\//g, path.sep));
  if (!fs.existsSync(postPath)) return null;
  const html = fs.readFileSync(postPath, "utf8");
  const meta = readMeta(html);
  if (!meta || !meta.date) return null;
  const chars = countReadableChars(html);
  const minutesOverride = Number(meta.minutes);
  const minutes = Number.isFinite(minutesOverride) && minutesOverride > 0
    ? Math.floor(minutesOverride)
    : Math.max(1, Math.ceil(chars / CHARS_PER_MINUTE));
  return `${formatZhDate(meta.date)} · ${minutes} 分钟 · ${chars} 字 · ${meta.author}`;
}

function syncIndex() {
  let index = fs.readFileSync(INDEX_PATH, "utf8");
  let changed = 0;

  index = index.replace(
    /(<article class="post-card"[\s\S]*?<a href="([^"]+)" class="post-card-link">[\s\S]*?<p class="post-card-stats">)([^<]*)(<\/p>)/g,
    (full, prefix, href, oldStats, suffix) => {
      const nextStats = postStatsForHref(href);
      if (!nextStats || nextStats === oldStats) return full;
      changed += 1;
      return `${prefix}${nextStats}${suffix}`;
    }
  );

  if (changed > 0) {
    fs.writeFileSync(INDEX_PATH, index, "utf8");
  }
  console.log(`sync-post-stats: ${changed} homepage card(s) updated`);
}

syncIndex();
