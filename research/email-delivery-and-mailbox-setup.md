# Email Delivery and Mailbox Setup

Quiet Hour has two distinct email needs. The public inbox is `hello@thaimassageforu.com`, which needs a readable mailbox for human replies. CMS messages need a transactional delivery service that can send template-controlled operational email without turning the mailbox into an application server.

| Need | Selected option | Why it fits the first launch | Activation owner |
| --- | --- | --- | --- |
| Human inbox | Zoho Mail custom-domain mailbox | A practical low-cost domain mailbox with browser and mobile access. | Domain owner |
| CMS transactional email | Resend | A developer-friendly transactional sender with a suitable free starting tier for early welcome, listing, enquiry, and payment messages. | Project owner |

## Mailbox: `hello@thaimassageforu.com`

Create the account in Zoho Mail, add `thaimassageforu.com` as a domain, then add the exact DNS verification and MX records Zoho presents. Create `hello` as a user mailbox—not merely a forwarding alias—so replies, archive history, and support handoffs remain manageable. Enable multi-factor authentication for every mailbox administrator.

## Transactional email: Resend

Create a Resend account, verify the sending domain using the provided SPF and DKIM records, and use a sender such as `Quiet Hour <hello@thaimassageforu.com>`. Add the Resend server token only through the project secret manager when live sending is approved. Keep test mode active until the deliverability and unsubscribe paths are checked.

## DNS and consent controls

Publish one authoritative SPF policy and the sender's DKIM records. Add a DMARC record in monitoring mode first, review aggregate reports, then move toward enforcement after legitimate senders are confirmed. Every marketing-style introduction should carry an unsubscribe route; SMS requires a recorded opt-in and a clear STOP instruction. Transactional booking and payment messages should stay purpose-limited and should not be silently repurposed as marketing.

## References

[1] [Resend pricing and sender-domain setup](https://resend.com/pricing)

[2] [Zoho Mail custom-domain email](https://www.zoho.com/mail/custom-domain-email.html)

[3] [DMARC.org — overview and deployment guidance](https://dmarc.org/overview/)
