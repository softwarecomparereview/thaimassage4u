# Content-Quality API Integration Record

The Quiet Hour article workflow uses the `desk-quality-v2` rewrite-and-score endpoint documented in the private [overpayingforai repository](https://github.com/softwarecomparereview/overpayingforai/blob/main/docs/content-quality-api-handover.md). The endpoint is `https://overpayingforai.com/api/content-quality` and accepts authenticated `GET` health checks and `POST` rewrite requests. It does not publish or retain caller drafts.

| Requirement | Implemented handling |
| --- | --- |
| Authentication | Server-side `CONTENT_QUALITY_API_KEY` only, sent as a Bearer token. |
| Pages deployment | The same key was configured as an encrypted `CONTENT_QUALITY_API_KEY` secret on the `overpayingforai` Cloudflare Pages production project. A clean main-branch rebuild was triggered so the function could load it. |
| Health validation | `GET /api/content-quality` returned the documented `desk-quality-v2` health response after deployment. |
| Article processing | Twenty source drafts were submitted individually. Refined files and a per-article audit report are stored in `content/articles-refined/` and `content/content-quality-report.json`. |
| Editorial safety | The import script preserves article frontmatter and Markdown structure, applying only traceable API replacement changes while rejecting replacement values containing URLs or dollar amounts. |

> The API is a language-quality editor, not a publisher or a medical review service. Keep wellness pieces in draft status until a human editor has checked factual and medical context.

## Source

[1] [overpayingforai content-quality API handover](https://github.com/softwarecomparereview/overpayingforai/blob/main/docs/content-quality-api-handover.md)
