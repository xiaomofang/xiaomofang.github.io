# AGENTS.md — MOFANG's Blog (tech-blog-github-pages)

Chinese LLM 技术博客，静态站点（原生 HTML/CSS/JS，无构建工具），部署到 GitHub Pages：
https://xiaomofang.github.io （仓库 `xiaomofang/xiaomofang.github.io`）。

## 仓库结构

- `index.html` — 首页：文章卡片（硬编码标题、摘要、分类、关键词、日期、分钟、字数）
- `app.js` — 首页筛选/搜索 + 文章页运行时统计字数与阅读时间
- `styles.css` — 全站样式（夜间为主，CSS 变量驱动的双主题）
- `posts/{basic,hardware-kernels,inference,reinforcement-learning,training}/xxx.html` — 文章
- `deploy.ps1` — 一键提交并推送（`git add .` + commit + push main）
- `tools/` — 临时/工具文件

## 文章结构（新文章必须遵守）

1. `<head>` 引用 `../../styles.css` 与 KaTeX 0.16.11（cdn.jsdelivr.net），含主题初始化 inline script
2. 页面底部脚本顺序：`../../app.js` → KaTeX + auto-render（delimiters: `\[ \]` 块级、`\( \)` 行内）
3. `<article class="post-page">`：
   - 头部：`post-page-category` → `h1.post-page-title` → `p.post-lead`（核心论断 + 引用来源链接）→ 关键词 chip（链接到 `../../index.html?keyword=xxx`）→ `p.post-page-meta`（`data-date` / `data-author` / `data-minutes`，不写死字数）
   - `div.logic-map` 逻辑地图（4 节点：start→ar→par→conv，灰→蓝→橙→绿，表达推理递进）
   - 正文 `section.post-page-content`：编号章节（一、二…）+ `x.y` 小节
   - 结尾 `essay-ending` 总结 → `references-section`（编号列表 + 一句注释）→ `comments-section`（utterances）

## 内容写作规范

- 中文学术科普：「是什么」推到「为什么只能这样」，每个结论给结构性论证（例：交叉熵文的"唯一性——不是习惯，是结构"）
- 关键公式必须自己手推验证；配 1–2 个可手算的小例子（例：5 词词表逐项算 CE）
- 每章配 `aside-card`（补充）或 `callout`（强结论）；对比用 `table.decision-table` / `calc-table`
- 公式用 KaTeX：行内 `\(...\)`，块级 `\[...\]` 包在 `<div class="math-block">` 里；公式内 `>` `<` 要写 `&gt;` `&lt;`
- 文章间互相链接保持知识图谱（例：交叉熵文引用 EAGLE 文 §4.2.1）
- 中文技术术语为主，英文术语保留原文；引用用「」；来源链接用中文维基/科学空间等
- 代码块 `<pre><code>`（PyTorch 示例用 `language-python` 类，app.js 会做高亮）

## 配色与 SVG 示意图（重要）

颜色全部用 CSS 变量，SVG 内不硬编码色值（fill 用 `class` 而非具体颜色）。

- 主题变量（`styles.css` 顶部）：夜间 bg `#0c0c0c`、text `#ededed`、accent 绿 `#6ee7a0`；日间 bg `#ffffff`、text `#1a1a1a`、accent `#16a34a`
- 三色语义：蓝 `var(--hue-blue)`=定义/公式、橙 `var(--hue-orange)`=对比/直觉、紫 `var(--hue-purple)`=落地/结论
- SVG 类：`d-box-blue/orange/purple`（实色圆角块）、`d-zone-blue/orange`（半透明区域）、`d-tag-blue/orange/purple`（标题）、`d-accent-blue/orange/purple`（强调元素）、`d-title`（图标题）、`d-muted`（注释）、`d-dim`（数值）、`d-label`（标签）、`d-axis`/`d-grid`（轴线）
- 画布统一 `viewBox="0 0 840 H"`，`role="img"` + 中文 `aria-label`，配 `<figcaption>` 一句话直觉
- 新样式若需新增，在 `styles.css` 的 `.diagram-figure` 段补充，并保持双主题变量驱动

## 字数与阅读时间口径（易错点）

文章页字数由 `app.js` 的 `countReadableChars()` **运行时计算**：
1. 克隆 `.post-page-content`
2. 删除 `pre / code / .katex / .katex-display / script / style / noscript`（KaTeX 渲染后公式全部不计）
3. 剩余文本：中文字符（`\u4e00-\u9fff\u3400-\u4dbf` 每个算 1）+ 英文/数字单词（`[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*`）之和
4. SVG `<text>` 里的文字会计入

因此：**首页 index.html 卡片里的字数必须用同一算法核算后再硬编码**，否则与文章页显示不一致。
阅读分钟：`data-minutes` 硬编码优先（例 40 分钟），否则按 300 字/分钟向上取整。

## 部署

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 "commit message"
```

脚本会 `git add .` 全部改动并 push main。首页和文章同仓，改 `index.html` 卡片与文章一起提交。

## 新文章发布清单

1. 按上述结构写 `posts/<category>/<slug>.html`
2. 用 app.js 相同算法核算字数（SVG 文字计入、公式/代码不计）
3. `index.html` 新增卡片：`data-category` / `data-keywords`（对应 app.js 的 `KEYWORD_LABELS`）/ `data-date` / `data-title` + 摘要 + 统计行
4. 检查关键词 chip 链接与 `index.html` 的 keyword 按钮一一对应
5. 运行 deploy.ps1 推送
