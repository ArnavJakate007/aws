# Arnav Jakate · Portfolio on AWS CloudFront

A static portfolio (HTML, CSS, JavaScript, WebGL) delivered worldwide by **Amazon CloudFront**, the AWS CDN.
**GitHub Pages** hosts the files as the origin. A **GitHub Actions** workflow invalidates the CloudFront
cache after every push, so visitors always get the latest version.

```
git push → GitHub Pages (origin) → AWS CloudFront (CDN · HTTPS · security headers · compression) → visitors
                     └── GitHub Actions → CloudFront invalidation
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Page content |
| `style.css` | Styling, responsive layout, animations |
| `app.js` | WebGL hero, smooth scroll (Lenis + GSAP), reveals, project filter, contact form |
| `.github/workflows/invalidate-cloudfront.yml` | CI/CD: refreshes the CloudFront cache on each push |

## Run locally

Open `index.html` with the VS Code **Live Server** extension. It needs internet for the fonts and CDN libraries.

## CloudFront configuration

| Setting | Value |
|---|---|
| Origin | `arnavjakate007.github.io`, origin path `/aws`, HTTPS only |
| Viewer protocol | Redirect HTTP → HTTPS |
| Cache policy | `CachingOptimized` (managed) |
| Response headers | `SecurityHeadersPolicy` (managed): HSTS, X-Frame-Options, nosniff, Referrer-Policy |
| Compression | Brotli + Gzip |
| Default root object | `index.html` |

## Auto cache refresh (one-time)

Repo → *Settings* → *Secrets and variables* → *Actions*. Add:

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | deploy user's access key |
| `AWS_SECRET_ACCESS_KEY` | deploy user's secret key |
| `CLOUDFRONT_DISTRIBUTION_ID` | e.g. `E1ABCDEF23GHIJ` |

Without these secrets the site still updates, but only once CloudFront's cache expires (up to about 24h). You can also invalidate manually:

```bash
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```
