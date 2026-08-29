# BUGTI Web

`web/` 是 BUGTI 原生微信小程序的静态浏览器镜像，使用原生 HTML、CSS 和 JavaScript，无需构建。

本地运行：

```bash
python -m http.server 8080 --directory web
```

然后访问 `http://localhost:8080/`。GitHub Pages 由 `.github/workflows/deploy-bugti-pages.yml` 发布 `web/` 目录。
