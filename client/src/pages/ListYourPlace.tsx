import { PageIntro, SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { Check, CircleDollarSign, Globe2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const benefits = ["A considered profile, not a crowded marketplace tile", "Treatment and practitioner details made easy to understand", "A city context built around real discovery intent", "Clear inquiry paths and a private studio dashboard"];

export default function ListYourPlace() {
  return <><SiteHeader /><main>
    <PageIntro eyebrow="For independent studios" title="Be found by people who are looking with intention." description="Quiet Hour is for thoughtful places: therapists, studios, recovery spaces, and wellness practices that deserve a clearer introduction." />
    <section className="partner-hero-panel"><div><p className="eyebrow">The listing standard</p><h2>Give your place the page it has earned.</h2><p>Your profile is managed in a clean CMS built for services, practitioners, local context, and a more human first impression.</p><Link href="/cms" className="dark-button">Open partner workspace</Link></div><div className="partner-benefits">{benefits.map((item, index) => <div key={item}><span>0{index + 1}</span><p>{item}</p><Check size={18} /></div>)}</div></section>
    <section className="pricing-section"><div><p className="eyebrow">Premium placement</p><h2>Choose the reach that matches your ambition.</h2><p>Recurring billing is explicit. Cancel from your dashboard at any time. Premium placement activates after successful payment and profile review.</p></div><div className="pricing-choices"><article><span className="pricing-icon"><CircleDollarSign size={20} /></span><p className="eyebrow">Premium city listing</p><h3>US$21 <small>/ week</small></h3><p>Priority visibility in one city, with a polished studio profile and local discovery context.</p><Link href="/cms" className="outline-button">Choose city</Link></article><article className="is-highlighted"><span className="pricing-icon"><Globe2 size={20} /></span><p className="eyebrow">Premium country listing</p><h3>US$159 <small>/ month</small></h3><p>Country-level discoverability and priority placement for studios with a wider audience.</p><Link href="/cms" className="dark-button">Choose country</Link></article></div></section>
    <section className="partner-assurance"><ShieldCheck size={27} /><p>Stripe manages payment credentials. Quiet Hour stores only the identifiers needed to connect placement to the correct profile.</p></section>
  </main><SiteFooter /></>;
}
