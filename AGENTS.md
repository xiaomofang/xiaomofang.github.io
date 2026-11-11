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

## 页面外壳与正文组织

1. `<head>` 引用 `../../styles.css` 与 KaTeX 0.16.11（cdn.jsdelivr.net），含主题初始化 inline script
2. 页面底部脚本顺序：`../../app.js` → KaTeX + auto-render（delimiters: `\[ \]` 块级、`\( \)` 行内）
3. `<article class="post-page">`：
   - 头部：`post-page-category` → `h1.post-page-title` → `p.post-lead`（核心论断 + 引用来源链接）→ 关键词 chip（链接到 `../../index.html?keyword=xxx`）→ `p.post-page-meta`（`data-date` / `data-author` / `data-minutes`，不写死字数）
   - 正文放在 `section.post-page-content`；标题、层级与顺序由本篇的具体问题决定，编号按需要使用。
   - 不固定添加 `logic-map` 或四节点卡片。图必须展示具体的数据、依赖、计算或状态变化，只有「找到问题→画出执行→定位源码→验证代价」等泛化标签时直接省略。
   - 保留 `references-section` 与 `comments-section`。结尾按内容自然结束，不强制添加 `essay-ending` 或重复总结。

## 内容写作规范

- 中文技术科普，从具体计算、现象和读者疑问展开；需要推导的地方给出推导，不把所有文章套成固定论证句式。
- 关键公式必须自己手推验证；配 1–2 个可手算的小例子（例：5 词词表逐项算 CE）
- `aside-card`、`callout`、表格与图只在确有信息组织价值时使用，不规定每章必须出现；可直接用连贯段落表达的内容不要再包装成卡片。
- 不在公开文章中填充「本专栏将如何研究」「每篇必须有哪些证据」等写作过程说明，不自动添加八股式自测、方法论流程和口号式结尾。复用主题、页头和统计功能，不机械照搬正文模板。
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
   - 关键词可以按文章主题新增，不限于现有列表；新增时同步 `app.js` 的 `KEYWORD_LABELS`、首页筛选按钮，以及对应文章和卡片的标签。
5. 运行 deploy.ps1 推送
