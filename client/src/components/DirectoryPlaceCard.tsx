import { ArrowUpRight, MapPin } from "lucide-react";
import { Link } from "wouter";

const fallbacks = [
  "linear-gradient(145deg, #d8d6c5 0%, #bfc6ac 100%)",
  "linear-gradient(145deg, #d7c6b3 0%, #bfa285 100%)",
  "linear-gradient(145deg, #c2d3ca 0%, #8da99a 100%)",
];

export function DirectoryPlaceCard({ place, index = 0 }: { place: any; index?: number }) {
  const visual = place.imageUrl ? { backgroundImage: `url(${place.imageUrl})` } : { background: fallbacks[index % fallbacks.length] };
  return (
    <Link href={`/listing/${place.slug}`} className="place-card">
      <div className="place-card__image" style={visual}>
        {!place.imageUrl && <span>Quiet Hour<br />listing</span>}
        <span className="place-card__arrow"><ArrowUpRight size={17} /></span>
      </div>
      <div className="place-card__copy">
        <div><p className="eyebrow">{place.categoryName || "Wellness"}</p><h3>{place.name}</h3></div>
        <p>{place.descriptor || "A considered wellness place."}</p>
        {place.neighbourhood && <span className="place-card__location"><MapPin size={14} />{place.neighbourhood}</span>}
      </div>
    </Link>
  );
}
