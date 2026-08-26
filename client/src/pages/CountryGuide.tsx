import { DirectoryPlaceCard } from "@/components/DirectoryPlaceCard";
import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { COUNTRIES, setCountryChoice } from "@/lib/country";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, KeyRound, MapPinned } from "lucide-react";
import { Link, useRoute } from "wouter";

export default function CountryGuide() {
  const [, params] = useRoute("/:code");
  const code = (params?.code ?? "").toLowerCase();
  const { data, isLoading, error } = trpc.directory.countryBySlug.useQuery({ code }, { enabled: Boolean(code) });

  if (isLoading) return <><SiteHeader /><main className="route-loading">Loading country guide…</main></>;
  if (error || !data) return <><SiteHeader /><main className="route-loading"><p className="eyebrow">Country guide</p><h1>This country isn’t in the directory yet.</h1><Link href="/directory" className="text-link">Return to the directory <ArrowUpRight size={16} /></Link></main><SiteFooter /></>;

  const { country, cities, listings } = data;

  return <><SiteHeader /><main>
    <section className="city-hero">
      <div><p className="eyebrow">Country guide</p><h1>Wellness in {country.name}.</h1></div>
      <p>{country.listingCount} independently listed place{country.listingCount === 1 ? "" : "s"} across {cities.length} cit{cities.length === 1 ? "y" : "ies"}.</p>
      <div className="country-switch" role="group" aria-label="Switch country">
        {COUNTRIES.map(option => (
          <Link
            key={option.code}
            href={`/${option.code}`}
            onClick={() => setCountryChoice(option.code)}
            className={option.code === country.code ? "country-switch__item is-active" : "country-switch__item"}
          >
            {option.flag} {option.name}
          </Link>
        ))}
      </div>
    </section>

    <section className="city-index-bar"><span><MapPinned size={17} /> {cities.length} cities covered</span></section>

    <section className="city-split-section">
      <div className="city-section-title"><p className="eyebrow">Cities</p><h2>Pick a city to explore.</h2></div>
      <div className="city-list">
        {cities.length ? cities.map((city: any, index: number) => (
          <Link href={`/city/${city.slug}`} className="city-row" key={city.id}>
            <span>0{index + 1}</span><h3>{city.name}</h3><p>{country.name}</p><ArrowUpRight size={20} />
          </Link>
        )) : <div className="city-row city-row--placeholder"><span>01</span><h3>City guides are being mapped.</h3><ArrowUpRight size={20} /></div>}
      </div>
    </section>

    <section className="places-section">
      <div className="section-heading"><div><p className="eyebrow">Independent places</p><h2>Every listing in {country.name}.</h2></div><Link href="/directory" className="text-link">Browse everywhere <ArrowUpRight size={16} /></Link></div>
      <div className="home-place-grid">
        {listings.length ? listings.map((place: any, index: number) => <DirectoryPlaceCard key={place.id} place={place} index={index} />) : <div className="home-place-empty"><h3>No published places yet in {country.name}.</h3></div>}
      </div>
    </section>

    <section className="claim-cta"><KeyRound size={22} /><div><h2>See your business here?</h2><p>Claim your listing in {country.name} to keep it up to date — no account to set up, just a one-time code to the contact details already on file.</p></div><Link href={`/claim?country=${country.code}`} className="dark-button">Claim your listing <ArrowUpRight size={16} /></Link></section>
  </main><SiteFooter /></>;
}
