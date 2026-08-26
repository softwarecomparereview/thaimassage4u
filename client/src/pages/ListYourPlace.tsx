import { PageIntro, SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { Check, CircleDollarSign, Globe2, ShieldCheck } from "lucide-react";
import { formatPremiumPrice, PREMIUM_TIERS } from "@shared/pricing";
import { Link } from "wouter";

const benefits = ["A considered profile, not a crowded marketplace tile", "Treatment and practitioner details made easy to understand", "A city context built around real discovery intent", "Clear inquiry paths and a private studio dashboard"];

export default function ListYourPlace() {
  return <><SiteHeader /><main>
    <PageIntro eyebrow="For independent studios" title="Be found by people who are looking with intention." description="Quiet Hour is for thoughtful places: therapists, studios, recovery spaces, and wellness practices that deserve a clearer introduction." />
    <section className="partner-hero-panel"><div><p className="eyebrow">The listing standard</p><h2>Give your place the page it has earned.</h2><p>Your profile is managed in a clean CMS built for services, practitioners, local context, and a more human first impression.</p><Link href="/cms" className="dark-button">Open partner workspace</Link></div><div className="partner-benefits">{benefits.map((item, index) => <div key={item}><span>0{index + 1}</span><p>{item}</p><Check size={18} /></div>)}</div></section>
    <section className="pricing-section"><div><p className="eyebrow">Premium placement</p><h2>Choose the reach that matches your ambition.</h2><p>Recurring billing is explicit. Cancel anytime. Paid placement is always labelled as featured, and never changes the organic ordering below it.</p></div><div className="pricing-choices">{(["city", "country"] as const).map((tier, index) => {
      const plan = PREMIUM_TIERS[tier];
      const [amount, interval] = formatPremiumPrice(tier).split(" / ");
      return <article key={tier} className={index === 1 ? "is-highlighted" : undefined}><span className="pricing-icon">{tier === "city" ? <CircleDollarSign size={20} /> : <Globe2 size={20} />}</span><p className="eyebrow">{plan.label}</p><h3>{amount} <small>/ {interval}</small></h3><p>{plan.description}</p><Link href="/directory" className={index === 1 ? "dark-button" : "outline-button"}>Find your listing</Link></article>;
    })}</div></section>
    <section className="partner-assurance"><ShieldCheck size={27} /><p>Stripe manages payment credentials. Quiet Hour stores only the identifiers needed to connect placement to the correct profile.</p></section>
  </main><SiteFooter /></>;
}
