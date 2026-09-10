import { PageIntro, SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { ArrowUpRight, KeyRound, Mail, Store } from "lucide-react";
import { Link } from "wouter";

export default function Contact() {
  return <>
    <SiteHeader />
    <main>
      <PageIntro eyebrow="Contact" title="Get in touch." description="For general questions, business owners and press." />
      <article className="article-detail" style={{ maxWidth: "760px", margin: "0 auto", padding: "0 1.25rem 5rem" }}>
        <div className="article-body">
          <p><Mail size={18} style={{ display: "inline", verticalAlign: "-3px", marginRight: "0.4rem" }} /><a href="mailto:hello@thaimassageforu.com">hello@thaimassageforu.com</a> — general questions, corrections, privacy or removal requests.</p>
          <h2>Own a listed business?</h2>
          <p><KeyRound size={18} style={{ display: "inline", verticalAlign: "-3px", marginRight: "0.4rem" }} />If you want to correct or manage your listing, <Link href="/claim">claim it here</Link> — a one-time code goes to the contact details already on file, no account needed.</p>
          <h2>Want to be listed, or list your business elsewhere?</h2>
          <p><Store size={18} style={{ display: "inline", verticalAlign: "-3px", marginRight: "0.4rem" }} />See <Link href="/list-your-place">listing your place</Link> for how premium placement and the claim process work.</p>
          <p><Link href="/directory" className="text-link">Browse the directory <ArrowUpRight size={16} /></Link></p>
        </div>
      </article>
    </main>
    <SiteFooter />
  </>;
}
