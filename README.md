# 来自火星的魔方 · 技术博客

个人技术博客，托管在 GitHub Pages。

**网站地址：** https://xiaomofang.github.io

---

## 首次发布

### 1. 登录 GitHub（只需一次）

在 PowerShell 中执行：

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth login
```

选择 `GitHub.com` → `HTTPS` → `Login with a web browser`，在浏览器完成授权。

### 2. 一键发布

```powershell
cd E:\AAA-LLM-CODE\tech-blog-github-pages
.\deploy.ps1
```

---

## 以后怎么更新

### 发新文章

1. 复制 `posts/post-llm-benchmark.html` 为新文件
2. 修改标题和正文
3. 在 `index.html` 文章列表新增一张卡片

### 发布更新

```powershell
cd E:\AAA-LLM-CODE\tech-blog-github-pages
.\deploy.ps1
```

或手动：

```powershell
git add .
git commit -m "Add new post: 文章标题"
git push
```
