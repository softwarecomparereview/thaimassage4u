import { PageIntro, SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { ArrowUpRight } from "lucide-react";
import { Link } from "wouter";

export default function About() {
  return <>
    <SiteHeader />
    <main>
      <PageIntro eyebrow="About" title="A city-by-city Thai massage directory." description="Built one city at a time, rather than as one flat national list." />
      <article className="article-detail" style={{ maxWidth: "760px", margin: "0 auto", padding: "0 1.25rem 5rem" }}>
        <div className="article-body">
          <p>Thai Massage For U is an independently run directory of Thai massage and wider wellness businesses, currently covering cities across Australia, the United States, the United Kingdom, Germany, Canada, New Zealand, Ireland and the UAE.</p>
          <p>Every listing carries real business information — address, phone number, opening hours where available, and Google ratings — organized around the way people actually search: by city first, then by the kind of place or treatment they're after.</p>
          <p>Businesses appear here from publicly available information. A business's owner can <Link href="/claim">claim their listing</Link> to verify it's theirs, keep it up to date, and — if they choose — pay for featured placement, always clearly labelled as such and never at the expense of the organic ranking beneath it.</p>
          <p>Quiet Hour is our journal: shorter, editorial pieces on massage, recovery and the cities we cover, alongside the directory itself.</p>
          <p><Link href="/journal" className="text-link">Read the journal <ArrowUpRight size={16} /></Link></p>
        </div>
      </article>
    </main>
    <SiteFooter />
  </>;
}
