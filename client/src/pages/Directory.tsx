import { DirectoryPlaceCard } from "@/components/DirectoryPlaceCard";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { trpc } from "@/lib/trpc";
import { Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

export default function Directory() {
  const { data, isLoading } = trpc.directory.home.useQuery();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const listings = (data?.listings ?? []).filter((place: any) => {
    const q = query.toLowerCase();
    const matchText = !q || [place.name, place.descriptor, place.cityName, place.neighbourhood].filter(Boolean).join(" ").toLowerCase().includes(q);
    return matchText && (activeCategory === "all" || place.categorySlug === activeCategory);
  });

  return <><SiteHeader /><main>
    <PageIntro eyebrow="Directory / global wellness index" title="A more considered way to choose a place." description="Browse independently listed studios, therapists, and slow-care rituals by city, treatment, and the feeling you want to leave with." />
    <section className="directory-controls">
      <label className="search-control"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by place, neighbourhood or city" /></label>
      <div className="category-chips" aria-label="Filter by category">
        <button className={activeCategory === "all" ? "is-active" : ""} onClick={() => setActiveCategory("all")}>All places</button>
        {(data?.categories ?? []).map((category: any) => <button key={category.id} className={activeCategory === category.slug ? "is-active" : ""} onClick={() => setActiveCategory(category.slug)}>{category.name}</button>)}
      </div>
      <span className="result-count"><SlidersHorizontal size={15} />{listings.length} {listings.length === 1 ? "place" : "places"}</span>
    </section>
    <section className="directory-grid" aria-live="polite">
      {isLoading && <p className="loading-copy">Gathering the city index…</p>}
      {!isLoading && listings.map((place: any, index: number) => <DirectoryPlaceCard key={place.id} place={place} index={index} />)}
      {!isLoading && listings.length === 0 && <div className="directory-empty"><span className="eyebrow">Field guide / first coordinates</span><h2>This index begins with place, not placeholders.</h2><p>There are no matching published places yet. New studios appear only after their profile, location, service details, and booking path are complete.</p><div className="directory-empty__trails"><span>01 / City context</span><span>02 / Treatment language</span><span>03 / Verified profile</span></div></div>}
    </section>
  </main><SiteFooter /></>;
}
