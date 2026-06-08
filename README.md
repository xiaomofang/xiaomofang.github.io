# 个人技术博客

记录大模型学习随笔与底层问题探究。

**网址：** https://xiaomofang.github.io

---

## 更新博客

修改文件后，在项目目录执行：

```powershell
cd E:\AAA-LLM-CODE\tech-blog-github-pages
git add .
git commit -m "更新内容"
git push
```

推送后刷新网页即可看到更新。

---

## 发新文章

文章按主题放到对应目录：

- `posts/basic/`：基础概念
- `posts/rl/`：强化学习与对齐
- `posts/training/`：训练系统
- `posts/hardware-kernels/`：硬件与算子
- `posts/inference-systems/`：推理系统

发文步骤：

1. 复制同类文章作为模板，修改标题和正文
2. 在 `index.html` 添加文章卡片，链接到新文章
3. 按上面步骤 `git add` → `commit` → `push`
