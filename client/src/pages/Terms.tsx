import { PageIntro, SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { formatPremiumPrice } from "@shared/pricing";

export default function Terms() {
  const cityPrice = formatPremiumPrice("city");
  const countryPrice = formatPremiumPrice("country");
  return <>
    <SiteHeader />
    <main>
      <PageIntro eyebrow="Legal" title="Terms of Service" description="The terms for using Thai Massage For U as a visitor, and for listing or claiming a business here." />
      <article className="article-detail" style={{ maxWidth: "760px", margin: "0 auto", padding: "0 1.25rem 5rem" }}>
        <div className="article-body">
          <p>Last updated: {new Date().toISOString().slice(0, 10)}.</p>

          <h2>What this site is</h2>
          <p>Thai Massage For U is an independently run directory of Thai massage and wellness businesses, organized by city and country. We aggregate and publish publicly available business information; we are not affiliated with, and do not represent, any listed business unless it has been claimed by its owner through our claim process.</p>

          <h2>Using the directory</h2>
          <p>Listings, ratings and descriptions are provided for informational purposes. We make a reasonable effort to keep them accurate but cannot guarantee that hours, pricing, availability or services offered are current — confirm directly with the business before visiting. Booking or contacting a business through a listing's outbound link or phone number is a transaction between you and that business; we are not a party to it.</p>

          <h2>Claiming a listing</h2>
          <p>Claiming a listing is available to the business it describes. Ownership is verified with a one-time code sent only to the phone number or email address already on file for that business — not to any address supplied at claim time. Claiming a listing you do not own or manage, or attempting to bypass this verification, is not permitted.</p>

          <h2>Premium placement</h2>
          <p>Premium placement ({cityPrice} for a single city, {countryPrice} for a full country) is a paid subscription that gives a listing priority position and a "Featured" label — it never removes or hides the organic ranking beneath it. Subscriptions are billed and managed through Stripe and can be cancelled at any time; placement ends when the subscription does. Featured placement is always clearly labelled as paid.</p>

          <h2>Inquiries</h2>
          <p>Messages sent through a listing's inquiry form are forwarded to help connect you with that business. We don't guarantee a response, and consent to be contacted by email or SMS is recorded separately for each channel and can be withdrawn at any time.</p>

          <h2>Removal requests</h2>
          <p>If you own or represent a business listed here and want it corrected or removed, email <a href="mailto:hello@thaimassageforu.com">hello@thaimassageforu.com</a> — we'll action reasonable requests promptly.</p>

          <h2>Liability</h2>
          <p>The directory is provided "as is." We are not liable for the accuracy of third-party listing information, for the quality or safety of services provided by listed businesses, or for any outcome of a booking or transaction made through this site.</p>

          <h2>Changes</h2>
          <p>We may update these terms as the site changes. Continued use after an update means you accept the current version.</p>

          <h2>Contact</h2>
          <p><a href="mailto:hello@thaimassageforu.com">hello@thaimassageforu.com</a></p>
        </div>
      </article>
    </main>
    <SiteFooter />
  </>;
}
