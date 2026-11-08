import { ArrowUpRight, MapPin, Phone, Star, TicketPercent } from "lucide-react";
import { Link } from "wouter";

const fallbacks = [
  "linear-gradient(145deg, #d8d6c5 0%, #bfc6ac 100%)",
  "linear-gradient(145deg, #d7c6b3 0%, #bfa285 100%)",
  "linear-gradient(145deg, #c2d3ca 0%, #8da99a 100%)",
];

/**
 * worker/directory.ts's toPlaceCard() has returned rating, reviewCount and phone in every
 * directory API response since before this file existed — none of it ever reached the actual
 * card. City/country/directory grids read as a plain list of names because the one component
 * every grid renders through never displayed the data it was already given. No new scraping or
 * schema change needed here; this is entirely a "use what's already in the response" fix.
 */
export function DirectoryPlaceCard({ place, index = 0 }: { place: any; index?: number }) {
  const visual = place.imageUrl ? { backgroundImage: `url(${place.imageUrl})` } : { background: fallbacks[index % fallbacks.length] };
  return (
    <Link href={`/listing/${place.slug}`} className="place-card">
      <div className="place-card__image" style={visual}>
        {!place.imageUrl && <span>Thai Massage<br />For U</span>}
        {typeof place.rating === "number" && (
          <span className="place-card__rating">
            <Star size={12} /> {place.rating.toFixed(1)}
            {place.reviewCount ? <small>({place.reviewCount})</small> : null}
          </span>
        )}
        <span className="place-card__arrow"><ArrowUpRight size={17} /></span>
      </div>
      <div className="place-card__copy">
        <div><p className="eyebrow">{place.categoryName || "Wellness"}</p><h3>{place.name}</h3></div>
        {place.offerTitle && <p className="place-card__offer"><TicketPercent size={13} /> {place.offerTitle}</p>}
        <p>{place.descriptor || "A considered wellness place."}</p>
        <div className="place-card__meta">
          {place.neighbourhood && <span className="place-card__location"><MapPin size={14} />{place.neighbourhood}</span>}
          {place.phone && <span className="place-card__location"><Phone size={14} />{place.phone}</span>}
        </div>
      </div>
    </Link>
  );
}
