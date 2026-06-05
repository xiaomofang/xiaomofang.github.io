# 一川疯月 · myblog-codes

Personal blog source code.

| | |
|---|---|
| **Site** | https://xiaomofang.github.io/myblog-codes |
| **Repo** | [xiaomofang/myblog-codes](https://github.com/xiaomofang/myblog-codes) |
| **Local** | `E:\AAA-LLM-CODE\myblog-codes` |

---

## Publish

```powershell
cd E:\AAA-LLM-CODE\myblog-codes
git push
```

Or with commit message:

```powershell
.\deploy.ps1 "feat: add new post"
```

If push fails with proxy error (`127.0.0.1:7890`), run once:

```powershell
git config --global --unset http.proxy
git config --global --unset https.proxy
```

---

## Rename local folder (if still `tech-blog-github-pages`)

Close Cursor, then:

```powershell
Rename-Item "E:\AAA-LLM-CODE\tech-blog-github-pages" "myblog-codes"
```
