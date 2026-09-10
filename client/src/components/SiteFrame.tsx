import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { COUNTRIES, setCountryChoice } from "@/lib/country";
import { ArrowUpRight, ChevronDown, Globe2, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const navItems = [
  { href: "/directory", label: "Explore" },
  { href: "/supplies", label: "Supplies" },
  { href: "/journal", label: "Journal" },
  { href: "/list-your-place", label: "For studios" },
  { href: "/coming-soon", label: "Roadmap" },
];

function CountrySwitcher({ mobile = false }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <div className="mobile-country-switch">
        {COUNTRIES.map(country => (
          <Link key={country.code} href={`/${country.code}`} onClick={() => setCountryChoice(country.code)}>
            {country.flag} {country.name}
          </Link>
        ))}
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="language-pill">
          <Globe2 size={14} /> Country <ChevronDown size={13} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {COUNTRIES.map(country => (
          <DropdownMenuItem key={country.code} asChild>
            <Link href={`/${country.code}`} onClick={() => setCountryChoice(country.code)}>{country.flag} {country.name}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The domain (thaimassageforu.com) is an exact-match search query that the "Quiet Hour" wordmark
 * used to bury entirely — a visitor landing from "thai massage" search results saw a brand name
 * that confirmed nothing about what the site actually is. Leads with the name now; "Quiet Hour"
 * stays as the smaller editorial identity underneath (still used that way in the journal), not
 * gone, just no longer standing in for what the domain itself already tells a visitor.
 */
export function Wordmark({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-[var(--font-display)] leading-none tracking-[-0.06em] ${inverted ? "text-[#f7f2e9]" : "text-[#19372f]"}`}>
      <span className="waypoint-mark" aria-hidden="true"><i /><i /></span>
      <span className="flex flex-col leading-[1.05]">
        <span className="text-[1.15rem]">Thai Massage For U</span>
        <span className="text-[0.62rem] uppercase tracking-[0.12em] opacity-60">Quiet Hour</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <Link href="/supplies" className="supplies-ribbon">Studio owners: today's cheapest supplies, delivered locally — <strong>massage sheets from $10, checked daily</strong> <ArrowUpRight size={15} /></Link>
      <div className="site-header__inner">
        <Wordmark />
        <nav className="site-nav" aria-label="Main navigation">
          {navItems.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        </nav>
        <div className="site-header__actions">
          <CountrySwitcher />
          <Link href="/list-your-place" className="header-cta">List your place <ArrowUpRight size={15} /></Link>
          <button type="button" className="menu-button" onClick={() => setOpen(!open)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}<ArrowUpRight size={17} /></Link>)}
          <CountrySwitcher mobile />
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div>
          <p className="eyebrow text-[#c7d1a3]">The slower index</p>
          <h2>Find your place<br />in the city.</h2>
        </div>
        <Link href="/directory" className="round-arrow" aria-label="Explore the directory"><ArrowUpRight size={25} /></Link>
      </div>
      <div className="site-footer__bottom">
        <Wordmark inverted />
        <p>Wellness discovery, built with a little more care.</p>
        <div className="footer-links"><Link href="/journal">Journal</Link><Link href="/list-your-place">Studios</Link><Link href="/supplies">Supplies</Link><Link href="/claim">Claim your listing</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="mailto:hello@thaimassageforu.com">hello@thaimassageforu.com</a></div>
      </div>
    </footer>
  );
}

export function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="page-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
