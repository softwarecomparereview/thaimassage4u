import { DirectoryPlaceCard } from "@/components/DirectoryPlaceCard";
import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { trpc } from "@/lib/trpc";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Compass, MapPin, Search, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";

const heroImage = "/manus-storage/quiet-hour-hero_b39a15ad.jpg";
const directoryImage = "/manus-storage/quiet-hour-directory_b168d1bb.jpg";
const editorialImage = "/manus-storage/quiet-hour-editorial_f5c1d05f.jpg";

export default function Home() {
  const { data, isLoading } = trpc.directory.home.useQuery();
  const [, setLocation] = useLocation();
  const premium = data?.premiumListings ?? [];
  const listings = data?.listings ?? [];
  const cities = data?.cities ?? [];
  const articles = data?.articles ?? [];
  const cityMetrics = data?.cityMetrics ?? [];
  const events = data?.verifiedEvents ?? [];
  const shouldScrollPremium = premium.length > 3;

  return <><SiteHeader /><main>
    <section className="home-hero" style={{ backgroundImage: `url(${heroImage})` }}>
      <div className="home-hero__wash" />
      <div className="home-hero__topline"><span>01 — The considered city guide</span><span>Global, slowly built</span></div>
      <div className="home-hero__content"><p className="eyebrow">Wellness, with a sense of place</p><h1>Find your<br /><em>quiet</em> in the city.</h1><p className="home-hero__lede">A more thoughtful index of massage, mindful movement, recovery, and places that help you feel like yourself again.</p><Link href="/directory" className="dark-button">Explore the directory <ArrowUpRight size={16} /></Link></div>
      <div className="hero-search-dock"><div><MapPin size={19} /><span><small>Where are you looking?</small><strong>{cities[0]?.name || "Choose a city"}</strong></span></div><div className="hero-search-dock__divider" /><div><Sparkles size={18} /><span><small>What would feel good?</small><strong>Massage, movement, stillness</strong></span></div><button type="button" onClick={() => setLocation("/directory")} aria-label="Search the directory"><Search size={20} /></button></div>
      <div className="hero-scroll-cue"><span>SCROLL TO EXPLORE</span><ArrowDownRight size={18} /></div>
    </section>

    <section className="manifesto-section"><p className="eyebrow">A slower index for busy places</p><div><h2>The best wellness recommendations are <em>felt</em>, not force-fed.</h2><p>Quiet Hour holds room for the studio down a side street, the practitioner people return to, and the small rituals that make a new city feel less unfamiliar. No noisy ratings. No false urgency. Just a clearer way to choose well.</p><Link href="/journal" className="text-link">Read the point of view <ArrowUpRight size={16} /></Link></div></section>

    <section className="explore-section"><div className="section-heading"><div><p className="eyebrow">Start close to home</p><h2>Every city has a different rhythm.</h2></div><Link href="/directory" className="text-link">See all places <ArrowUpRight size={16} /></Link></div><div className="city-list">{cities.length ? cities.slice(0, 4).map((city: any, index: number) => <Link href={`/city/${city.slug}`} className="city-row" key={city.id}><span>0{index + 1}</span><h3>{city.name}</h3><p>{city.country}</p><ArrowUpRight size={20} /></Link>) : <div className="city-row city-row--placeholder"><span>01</span><h3>Your first city, carefully mapped.</h3><p>City guides open once their local information is ready to be useful.</p><ArrowUpRight size={20} /></div>}</div></section>

    <section className="feature-split"><div className="feature-split__image" style={{ backgroundImage: `url(${directoryImage})` }}><span className="image-label">The directory<br />made personal</span></div><div className="feature-split__copy"><p className="eyebrow">Made for the way people actually choose</p><h2>A complete picture, before you give away an afternoon.</h2><p>Places earn their page through considered detail: what they do, who it is for, how to book, and the surrounding city context that makes the visit make sense.</p><div className="feature-points"><span><Compass size={19} /> City-first discovery</span><span><CalendarDays size={19} /> Direct booking paths</span><span><Sparkles size={19} /> Source-backed city signals</span></div><Link href="/list-your-place" className="dark-button">List your studio <ArrowUpRight size={16} /></Link></div></section>

    <section className="premium-section"><div className="premium-section__heading"><p className="eyebrow">Quietly premium</p><h2>Places taking a little more room in the city.</h2><p>Premium placement is reserved for completed, reviewed profiles. The ribbon moves only when the collection is ready to move with it.</p><Link href="/list-your-place" className="text-link">See premium options <ArrowUpRight size={16} /></Link></div><div className={`premium-ribbon ${shouldScrollPremium ? "is-moving" : ""}`} aria-label="Premium listing ribbon">{premium.length ? premium.map((place: any) => <Link href={`/listing/${place.slug}`} key={place.id} className="premium-ribbon__item"><span className="premium-dot" /><strong>{place.name}</strong><small>{place.cityName} · {place.categoryName}</small><ArrowUpRight size={16} /></Link>) : <div className="premium-ribbon__empty"><span className="premium-dot" /> The premium collection is being prepared with the first city profiles.</div>}</div></section>

    <section className="places-section"><div className="section-heading"><div><p className="eyebrow">New in the index</p><h2>Independent places, clearly introduced.</h2></div><Link href="/directory" className="text-link">Browse the index <ArrowUpRight size={16} /></Link></div><div className="home-place-grid">{isLoading ? <p className="loading-copy">Gathering the city index…</p> : listings.length ? listings.slice(0, 3).map((place: any, index: number) => <DirectoryPlaceCard key={place.id} place={place} index={index} />) : <div className="home-place-empty"><p className="eyebrow">Directory standard</p><h3>New studios are added after their information is complete.</h3><p>That means a more useful first visit for everyone who finds them here.</p><Link href="/list-your-place" className="text-link">Become an early partner <ArrowUpRight size={16} /></Link></div>}</div></section>

    <section className="intelligence-section"><div className="intelligence-section__head"><p className="eyebrow">City intelligence</p><h2>Useful context,<br />not invented hype.</h2><p>Each city layer makes space for official events, seasonal visitor timing, and source-linked notes. Numbers only appear when there is a method and a source behind them.</p></div><div className="intelligence-section__content">{cityMetrics.length ? cityMetrics.slice(0, 3).map((metric: any, index: number) => <article className="intelligence-metric" key={metric.id}><span>0{index + 1}</span><strong>{metric.value}</strong><p>{metric.label}</p><small>{metric.sourceName}</small></article>) : <article className="intelligence-empty"><span>01</span><h3>Built for verified local signals.</h3><p>When the local desk adds a city event, seasonal wellness note, or observed metric, it will show the original source and the date it was checked.</p></article>}{events.length ? <div className="mini-event"><CalendarDays size={18} /><p><strong>{events[0].title}</strong><br />Verified city event</p></div> : null}</div></section>

    <section className="journal-feature"><div className="journal-feature__copy"><p className="eyebrow">From the journal</p><h2>Wellness intelligence for ordinary days.</h2><p>Longer reads on mindfulness, massage, circulation, and the small conditions that help a body feel more at home.</p><Link href="/journal" className="dark-button">Open the journal <ArrowUpRight size={16} /></Link>{articles[0] && <Link href={`/journal/${articles[0].slug}`} className="journal-feature__latest"><span>Latest guide</span><strong>{articles[0].title}</strong><ArrowUpRight size={17} /></Link>}</div><div className="journal-feature__image" style={{ backgroundImage: `url(${editorialImage})` }} /></section>
  </main><SiteFooter /></>;
}
