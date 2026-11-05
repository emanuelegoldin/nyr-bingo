# Assets, copied code and external services

## Fonts

Loaded in `nextjs/src/app/layout.tsx` from the Google Fonts CDN:

```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@400;500;700
```

| Font | Weights | License | Author | Purpose |
|------|---------|---------|--------|---------|
| Inter | 400, 500, 700 | SIL Open Font License 1.1 | Rasmus Andersson | Body text. |
| Space Grotesk | 400, 500, 700 | SIL Open Font License 1.1 | Florian Karsten | Headings. |

**License:** OFL-1.1 allows free use, including commercial use, embedding and
self-hosting. The only restrictions are that the fonts may not be sold on
their own, and modified versions may not use the reserved font name. Websites
do not need to show attribution.

**Privacy (GDPR):** loading from `fonts.googleapis.com` / `fonts.gstatic.com`
sends each visitor's IP address to Google. In 2022 the Regional Court of
Munich (LG München I, 3 O 17493/20) found that doing this without consent
breaks the GDPR. If the app targets EU users, the low-effort fix is to
self-host the fonts (e.g. with `next/font/google`, which downloads them at
build time and serves them from our domain). Otherwise, mention Google Fonts
in the privacy policy and cookie/consent banner.

## Copied source code

| Code | Location | License | Notes |
|------|----------|---------|-------|
| shadcn/ui components | `nextjs/src/components/ui/*` (configured by `nextjs/components.json`) | MIT | shadcn/ui copies component source into the project instead of installing a package, so this code is now ours to maintain. The MIT license still applies to the copied parts. Keeping a credit to shadcn/ui (https://github.com/shadcn-ui/ui) in the third-party notices is recommended. |
| Dockerfile pattern | `nextjs/docker/Dockerfile.nextjs` | n/a | Comment says it was adapted from a depot.dev example. Common boilerplate; no obligations. |

## Static media

| File | Origin | License |
|------|--------|---------|
| `nextjs/public/media/logo.webp` | **Unknown / not documented** | **To verify** |
| `nextjs/public/media/home-it.webp` | **Unknown / not documented** | **To verify** |

Before publishing, confirm these images were made by us or come from a source
whose license allows commercial use (and note any attribution it requires).
If they were AI-generated, record the tool and its terms of use.

User uploads (`nextjs/uploads/`) are user content. Their use is governed by
the app's Terms of Service, not by third-party licenses.

## External services used at runtime

| Service | Configured via | Purpose | Cost / terms |
|---------|----------------|---------|--------------|
| SMTP server (provider not fixed in code) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | Sends emails through `nodemailer`. | Depends on the chosen provider. Most have a free tier and paid volume plans. Pick a provider with an EU data processing agreement if handling EU users. |
| Google Fonts CDN | hard-coded in `layout.tsx` | Serves web fonts. | Free. See the privacy note above. |

The app has no other runtime calls to third-party APIs. Database, WebSocket
server and Nginx are all self-hosted (see
[container-images.md](container-images.md)).
