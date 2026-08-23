# Cloudflare Security Hardening Plan

Quiet Hour should use Cloudflare as the public edge-control plane. The application server remains responsible for authentication and authorization, while Cloudflare absorbs common automated abuse and enforces domain-level transport and DNS protections.

| Control | Recommended production setting | Reason |
| --- | --- | --- |
| TLS | Full (strict), always use HTTPS, automatic HTTPS rewrites | Prevents plaintext traffic and verifies the origin certificate. |
| WAF | Enable managed rules; start custom rules in log/simulate mode | Gives bot and exploit coverage without immediately blocking legitimate partners. |
| Rate limiting | Protect `/api/trpc`, `/api/stripe/webhook`, and public enquiry submissions with route-specific thresholds | Limits credential stuffing, spam, and costly request bursts. |
| Turnstile | Use on public listing and enquiry submissions | Adds a privacy-focused challenge before write operations. |
| DNS email records | SPF, DKIM, and DMARC for the verified sender domain | Makes domain email easier to authenticate and harder to impersonate. |
| Observability | Review security events and WAF/rate-limit activity weekly during launch | Converts edge controls into an operational feedback loop. |

The project should not enable an aggressive bot block before observing traffic. First use managed rules and route-level rate limits, record false positives, and then tighten custom controls. CMS, payment, webhook, and API paths must be allowed deliberately so security rules do not interrupt authenticated operations.

## Implemented baseline

On 2026-08-23, the active `thaimassageforu.com` Cloudflare zone was verified as active with HTTPS redirection already enabled. The minimum TLS version was raised from 1.0 to **1.2**, and the Cloudflare security level was raised from **medium** to **high**. The existing TLS origin mode was deliberately left unchanged to avoid an unverified origin-certificate change. The application also sends `nosniff`, anti-framing, referrer, permissions, opener, and HSTS headers.

## References

[1] [Cloudflare WAF getting started](https://developers.cloudflare.com/waf/get-started/)

[2] [Cloudflare rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)

[3] [Cloudflare Turnstile documentation](https://developers.cloudflare.com/turnstile/)
