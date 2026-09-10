import { PageIntro, SiteFooter, SiteHeader } from "@/components/SiteFrame";

/**
 * Every claim in here is checked against what the code actually does, not boilerplate — see the
 * cookie names, table names and third parties cited inline. Update this file (and the D1/cookie
 * facts it describes) together whenever either one changes.
 */
export default function Privacy() {
  return <>
    <SiteHeader />
    <main>
      <PageIntro eyebrow="Legal" title="Privacy Policy" description="What Thai Massage For U collects, why, and who it's shared with." />
      <article className="article-detail" style={{ maxWidth: "760px", margin: "0 auto", padding: "0 1.25rem 5rem" }}>
        <div className="article-body">
          <p>Last updated: {new Date().toISOString().slice(0, 10)}.</p>

          <h2>What we collect</h2>
          <p><strong>If you visit the site:</strong> Google Analytics (GA4) records page views and interactions like clicking through to a listing, starting a checkout, or searching for a listing to claim. Cloudflare, our hosting provider, also logs standard request data (IP address, browser, pages requested) for security and performance. We use a small number of cookies: <code>tmfu_country</code> and <code>tmfu_intl</code> remember which country's directory you're browsing; if you claim a listing, <code>app_session_id</code> keeps you signed in to manage it.</p>
          <p><strong>If you send an inquiry to a listed business:</strong> we store your name, email, phone (if given) and message, plus whether you consented to be contacted by email and/or SMS, so the business can follow up with you.</p>
          <p><strong>If you claim a listing:</strong> we send a one-time verification code to the phone number or email address already on file for that business — never to an address you type in yourself — and record that the listing has been claimed.</p>
          <p><strong>If you pay for premium placement:</strong> Stripe processes the payment. We never see or store your card details; we keep only the subscription and customer identifiers Stripe gives us, so we can activate and later manage the placement.</p>
          <p><strong>Business listing data</strong> (name, address, phone, photos, hours, ratings) is sourced from publicly available information about businesses — primarily Google Maps — not collected from the businesses themselves unless they claim and update their listing.</p>

          <h2>Who we share it with</h2>
          <p>We don't sell personal data. It's shared only with the services that make the site work: Google (Analytics), Cloudflare (hosting, security, our database), Stripe (payments), and our transactional email providers (Cloudflare Email, with Resend, Brevo or Mailjet as backups if the primary is unavailable) to send you emails you've requested, like an inquiry confirmation or a claim code.</p>

          <h2>Cookies</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", margin: "1rem 0" }}>
            <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}><th style={{ padding: "0.4rem 0.6rem 0.4rem 0" }}>Cookie</th><th style={{ padding: "0.4rem 0.6rem" }}>Purpose</th><th style={{ padding: "0.4rem 0" }}>Lifetime</th></tr></thead>
            <tbody>
              <tr><td style={{ padding: "0.4rem 0.6rem 0.4rem 0" }}><code>tmfu_country</code></td><td style={{ padding: "0.4rem 0.6rem" }}>Remembers your chosen country directory</td><td style={{ padding: "0.4rem 0" }}>1 year</td></tr>
              <tr><td style={{ padding: "0.4rem 0.6rem 0.4rem 0" }}><code>tmfu_intl</code></td><td style={{ padding: "0.4rem 0.6rem" }}>Remembers you asked to see the global page instead of being redirected</td><td style={{ padding: "0.4rem 0" }}>1 year</td></tr>
              <tr><td style={{ padding: "0.4rem 0.6rem 0.4rem 0" }}><code>app_session_id</code></td><td style={{ padding: "0.4rem 0.6rem" }}>Keeps you signed in after claiming a listing</td><td style={{ padding: "0.4rem 0" }}>1 year, set only if you claim a listing</td></tr>
            </tbody>
          </table>
          <p>Search engines and other automated crawlers reading the site are not tracked by Google Analytics and don't receive these cookies.</p>

          <h2>Your choices</h2>
          <p>Marketing or campaign emails include an unsubscribe link that takes effect immediately. You can ask us to tell you what we hold on you, or to delete an inquiry or a claimed listing's data, by emailing <a href="mailto:hello@thaimassageforu.com">hello@thaimassageforu.com</a>.</p>

          <h2>Contact</h2>
          <p>Questions about this policy: <a href="mailto:hello@thaimassageforu.com">hello@thaimassageforu.com</a>.</p>
        </div>
      </article>
    </main>
    <SiteFooter />
  </>;
}
