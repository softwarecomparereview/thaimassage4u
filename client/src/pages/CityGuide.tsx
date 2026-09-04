import { Concierge } from "@/components/Concierge";
import { DirectoryPlaceCard } from "@/components/DirectoryPlaceCard";
import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, CalendarDays, MapPinned, Sparkles } from "lucide-react";
import { Link, useRoute } from "wouter";

function formattedDate(value: Date | string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function CityGuide() {
  const [, params] = useRoute("/city/:slug");
  const slug = params?.slug ?? "";
  const { data, isLoading, error } = trpc.directory.cityBySlug.useQuery({ slug }, { enabled: Boolean(slug) });
  if (isLoading) return <><SiteHeader /><main className="route-loading">Loading city guide…</main></>;
  if (error || !data) return <><SiteHeader /><main className="route-loading"><p className="eyebrow">City guide</p><h1>This guide is still being mapped.</h1><Link href="/directory" className="text-link">Return to the directory <ArrowUpRight size={16} /></Link></main><SiteFooter /></>;
  const { city, listings, events, metrics } = data;
  return <><Concierge /><SiteHeader /><main>
    <section className="city-hero">
      <div><p className="eyebrow">{city.country} / {city.primaryLocale.toUpperCase()}</p><h1>{city.name}, at a softer pace.</h1></div>
      <p>{city.introduction || "A city guide is being assembled with local context, verified sources, and careful wellness discovery."}</p>
    </section>
    <section className="city-index-bar"><span><MapPinned size={17} /> {listings.length} published places</span><span><CalendarDays size={17} /> {events.length} verified upcoming events</span><span><Sparkles size={17} /> Source-backed city signals</span></section>
    <section className="city-split-section">
      <div className="city-section-title"><p className="eyebrow">Wellness map</p><h2>Places worth leaving the busy part of town for.</h2><Link href="/directory" className="text-link">Explore all places <ArrowUpRight size={16} /></Link></div>
      <div className="city-place-rail">{listings.length ? listings.slice(0, 3).map((place: any, index: number) => <DirectoryPlaceCard key={place.id} place={place} index={index} />) : <div className="city-empty-note">This city’s first reviewed places will appear here.</div>}</div>
    </section>
    <section className="city-signals">
      <div><p className="eyebrow">City intelligence</p><h2>Know the city before you book the treatment.</h2><p>Signals are published only with a named source and the date we last checked it.</p></div>
      <div className="signal-list">{metrics.length ? metrics.map((metric: any) => <article key={metric.id} className="signal-row"><span>{metric.label}</span><strong>{metric.value}</strong><small><a href={metric.sourceUrl} target="_blank" rel="noreferrer">{metric.sourceName}</a> · checked {formattedDate(metric.observedAt)}</small></article>) : <div className="signal-empty"><span>01</span><p>City timing, seasonal patterns, and source-backed demand notes will appear here as the local desk verifies them.</p></div>}</div>
    </section>
    <section className="event-section"><div><p className="eyebrow">On the calendar</p><h2>Events that shift the city’s rhythm.</h2></div><div className="event-list">{events.length ? events.map((event: any) => <article className="event-row" key={event.id}><time>{formattedDate(event.startsAt)}</time><div><h3>{event.title}</h3><p>{event.description}</p><a href={event.sourceUrl} target="_blank" rel="noreferrer">Source: {event.sourceName} <ArrowUpRight size={14} /></a></div></article>) : <div className="event-empty"><CalendarDays size={25} /><p>Official city events will appear here after source verification—not automated guesswork.</p></div>}</div></section>
  </main><SiteFooter /></>;
}
