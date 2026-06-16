# 个人技术博客

记录大模型学习随笔与底层问题探究。

**网址：** https://xiaomofang.github.io

---

## 一键发布（推荐）

项目根目录提供了 `deploy.ps1`，会自动完成：`git add` → `commit` → `push`。

### 前置条件

1. 已安装 [Git](https://git-scm.com/)
2. 已安装 [GitHub CLI](https://cli.github.com/)（`gh`）
3. 已登录 GitHub：

```powershell
gh auth login
```

### 用法

在项目目录打开 PowerShell，执行：

```powershell
cd E:\AAA-LLM-CODE\tech-blog-github-pages

# 默认提交信息：chore: update site content
.\deploy.ps1

# 自定义提交信息（推荐发新文章时使用）
.\deploy.ps1 "feat: add FlashAttention deep dive post"
```

若 PowerShell 提示「无法运行脚本」，先执行（仅当前窗口生效）：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

然后再运行 `.\deploy.ps1`。

### 脚本做了什么

| 步骤 | 说明 |
|------|------|
| 检查 `gh` | 未安装或未登录会提示并退出 |
| `git add .` | 暂存所有改动 |
| `git commit` | 有改动才提交；无改动则跳过 |
| `git push` | 推送到 `origin/main` |

推送成功后，等 GitHub Pages 构建 1–2 分钟，刷新 https://xiaomofang.github.io 即可。

---

## 手动发布（不用脚本）

修改文件后，在项目目录执行：

```powershell
cd E:\AAA-LLM-CODE\tech-blog-github-pages
git add .
git commit -m "更新内容"
git push
```

---

## 发新文章

文章按主题放到对应目录：

- `posts/basic/`：Basic Knowledge，基础概念
- `posts/inference/`：Inference，推理系统
- `posts/reinforcement-learning/`：Reinforcement Learning，强化学习与对齐
- `posts/training/`：Training，训练系统
- `posts/hardware-kernels/`：Hardware & Kernels，硬件与算子

发文步骤：

1. 复制同类文章 HTML 作为模板，修改标题和正文
2. 在 `index.html` 添加文章卡片，链接到新文章
3. 执行 `.\deploy.ps1 "feat: 文章标题简述"` 或手动 `git add` → `commit` → `push`

新文章路径示例：`posts/inference/flash-attention-deep-dive.html`  
线上地址：`https://xiaomofang.github.io/posts/inference/flash-attention-deep-dive.html`
