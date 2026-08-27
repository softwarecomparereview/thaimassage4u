import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { COUNTRIES } from "@/lib/country";
import { ArrowUpRight, PackageOpen, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useRoute, useSearch } from "wouter";

type Offer = { id: number; title: string; price: number; shipping: number | null; total: number; currency: string; freeShipping: boolean; url: string; image: string | null; supplier: string };
type Category = { key: string; label: string; compareUrl: string | null; offers: Offer[] };
type SuppliesPayload = { country: string; updatedAt: string | null; categories: Category[] };

const SYMBOLS: Record<string, string> = { USD: "$", AUD: "A$", GBP: "£", EUR: "€" };

function money(value: number, currency: string) {
  return `${SYMBOLS[currency] ?? ""}${value.toFixed(2)}`;
}

/**
 * Daily-refreshed cheapest supplies per country, for the businesses listed in
 * the directory. Offers come from /api/supplies (see worker/supplies.ts);
 * some outbound links are affiliate links, disclosed below the list.
 */
export default function Supplies() {
  const search = useSearch();
  const [, params] = useRoute("/:code/supplies");
  const codes = new Set(COUNTRIES.map(option => option.code as string));
  // Country comes from the path (/au/supplies); bare /supplies is geo-redirected by
  // the Worker, but keep ?country= and an AU default as client-side fallbacks.
  const country = (params?.code && codes.has(params.code) ? params.code : null) ?? new URLSearchParams(search).get("country") ?? "au";
  const [data, setData] = useState<SuppliesPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/supplies?country=${country}`)
      .then(response => response.json())
      .then((payload: SuppliesPayload) => setData(payload))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [country]);

  const populated = data?.categories.filter(category => category.offers.length) ?? [];
  const emptyCategories = data?.categories.filter(category => !category.offers.length) ?? [];

  return <><SiteHeader /><main>
    <section className="page-intro"><p className="eyebrow">For studio owners</p><h1>Today's cheapest supplies, delivered locally.</h1>
      <p>Re-checked daily across the essentials a massage business actually re-buys — sorted by total price with delivery included. Pick your country:</p>
      <div className="country-switch" role="group" aria-label="Choose country">
        {COUNTRIES.map(option => (
          <Link key={option.code} href={`/${option.code}/supplies`} className={option.code === country ? "country-switch__item is-active" : "country-switch__item"}>
            {option.flag} {option.name}
          </Link>
        ))}
      </div>
    </section>

    {loading ? <section className="places-section"><p className="loading-copy">Checking today's prices…</p></section> : <>
      {populated.map(category => (
        <section className="places-section supplies-section" key={category.key}>
          <div className="section-heading"><div><p className="eyebrow">Supplies</p><h2>{category.label}</h2></div>
            {category.compareUrl && <a href={category.compareUrl} target="_blank" rel="noreferrer noopener sponsored" className="text-link">Compare on AliExpress <ArrowUpRight size={16} /></a>}
          </div>
          <div className="supply-grid">
            {category.offers.map(offer => (
              <a className="supply-card" key={offer.id} href={`/api/supplies/go?id=${offer.id}`} target="_blank" rel="noreferrer noopener">
                {offer.image ? <div className="supply-card__image" style={{ backgroundImage: `url(${offer.image})` }} /> : <div className="supply-card__image supply-card__image--empty"><PackageOpen size={22} /></div>}
                <div className="supply-card__body">
                  <h3>{offer.title}</h3>
                  <p className="supply-card__price">{money(offer.total, offer.currency)}{offer.freeShipping ? <span className="supply-card__ship"><Truck size={13} /> free delivery</span> : offer.shipping ? <span className="supply-card__ship">incl. {money(offer.shipping, offer.currency)} delivery</span> : null}</p>
                  <span className="supply-card__source">{offer.supplier} <ArrowUpRight size={13} /></span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
      {!populated.length && <section className="places-section"><div className="home-place-empty"><h3>Today's scan hasn't landed for this country yet.</h3><p>Prices refresh daily — check back shortly.</p></div></section>}
      {emptyCategories.length > 0 && populated.length > 0 && (
        <section className="places-section supplies-section">
          <div className="section-heading"><div><p className="eyebrow">More categories</p><h2>Also worth comparing.</h2></div></div>
          <div className="supply-compare-row">
            {emptyCategories.map(category => category.compareUrl && (
              <a key={category.key} href={category.compareUrl} target="_blank" rel="noreferrer noopener sponsored" className="supply-compare-pill">{category.label} <ArrowUpRight size={14} /></a>
            ))}
          </div>
        </section>
      )}
      <section className="places-section"><p className="supply-disclosure">Prices are re-checked daily from public marketplace listings and include delivery where shown; final prices are set by each seller. Some outbound links are affiliate links — buying through them supports the directory at no cost to you.{data?.updatedAt ? ` Last refreshed ${data.updatedAt} UTC.` : ""}</p></section>
    </>}
  </main><SiteFooter /></>;
}
