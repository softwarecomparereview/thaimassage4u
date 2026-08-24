import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import {
  Bell,
  BotMessageSquare,
  CalendarCheck2,
  CircleDollarSign,
  Globe2,
  LineChart,
  Link2,
  ListChecks,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: CalendarCheck2,
    title: "AI booking concierge",
    body: "Book a real appointment straight from a listing page — the assistant checks a studio's live availability and confirms the slot, no phone tag required.",
  },
  {
    icon: CircleDollarSign,
    title: "Deposit collection & no-show protection",
    body: "Studios set their own deposit policy; we collect it securely at booking time via Stripe, so a no-show costs the studio nothing.",
  },
  {
    icon: ListChecks,
    title: "Smart waitlist & auto-rebooking",
    body: "A cancellation doesn't have to mean an empty slot — the next best-matched waitlisted customer gets offered it automatically.",
  },
  {
    icon: BotMessageSquare,
    title: "\"Help me choose\" concierge chat",
    body: "Sore back, jet lag, first time getting a massage — describe what you need and get matched to the right studio and service, not just a list.",
  },
  {
    icon: MessagesSquare,
    title: "Automated review requests",
    body: "A well-timed, honest request after the visit — with anything critical routed privately to the studio first, never fabricated or gamed.",
  },
  {
    icon: LineChart,
    title: "Dynamic pricing suggestions",
    body: "Real demand patterns per city, turned into plain suggestions for a studio's own off-peak pricing — never applied without their say-so.",
  },
  {
    icon: Globe2,
    title: "Real multi-language pages",
    body: "City guides and listings in the language a searcher actually used — kept in sync automatically as the English source changes, not a one-off translation that goes stale.",
  },
  {
    icon: Link2,
    title: "Calendar & POS sync",
    body: "Two-way sync with the booking system a studio already uses — Fresha, Square, Booksy — so availability here is never out of date.",
  },
  {
    icon: ShieldCheck,
    title: "Fraud & spam screening",
    body: "Inquiries and new listings get screened before they reach a studio's inbox or go live — the CRM stays useful, not noisy.",
  },
];

export default function ComingSoon() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-intro">
          <p className="eyebrow"><Sparkles size={13} /> On the roadmap</p>
          <h1>What we're building next.</h1>
          <p>
            The directory works today — real listings, real premium placement, real outreach. These are the features
            we're actively designing to make the whole experience feel less like a listing and more like a front desk.
            Nothing below is live yet; nothing will ship claiming results it hasn't earned.
          </p>
        </section>

        <section className="coming-soon-grid">
          {FEATURES.map(feature => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="coming-soon-card">
                <Icon size={22} />
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            );
          })}
        </section>

        <section className="coming-soon-cta">
          <Bell size={20} />
          <div>
            <h2>Want to hear when one of these ships?</h2>
            <p>Studios already listed will hear first — no separate signup needed.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
