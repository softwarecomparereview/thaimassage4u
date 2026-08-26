import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { ArrowUpRight, KeyRound, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";

type Result = { slug: string; name: string; citySlug: string; countryCode: string; claimed: boolean };

/**
 * Entry point for "claim your listing" from a general page (home, a country
 * page) that doesn't already know which listing is the visitor's — they
 * find it by name here, then the actual claim (OTP to the on-file contact)
 * happens on the listing's own page, same as clicking through from search.
 */
export default function ClaimSearch() {
  const search = useSearch();
  const country = new URLSearchParams(search).get("country") ?? "";
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    setLoading(true);
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ q: q.trim() });
      if (country) params.set("country", country);
      fetch(`/api/claim/search?${params}`)
        .then(r => r.json())
        .then((body: { results: Result[] }) => setResults(body.results))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [q, country]);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-intro">
          <p className="eyebrow"><KeyRound size={14} /> Own a listing?</p>
          <h1>Find your business to claim it.</h1>
          <p>Search by business name. Claiming sends a one-time code to the contact details already on file — no password, no account to set up.</p>
        </section>
        <section className="claim-search">
          <div className="claim-search__box">
            <Search size={18} />
            <input autoFocus placeholder="Your business name" value={q} onChange={event => setQ(event.target.value)} />
          </div>
          {loading && <p className="claim-search__status">Searching…</p>}
          {!loading && results && results.length === 0 && <p className="claim-search__status">No listing matched "{q}" — try a shorter or different part of the name.</p>}
          {results && results.length > 0 && (
            <div className="claim-search__results">
              {results.map(result => (
                <Link key={result.slug} href={`/listing/${result.slug}`} className="claim-search__result">
                  <span><strong>{result.name}</strong><small>{result.citySlug.replace(/-/g, " ")}, {result.countryCode.toUpperCase()}</small></span>
                  {result.claimed ? <small className="claim-search__claimed">Already claimed</small> : <ArrowUpRight size={18} />}
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
