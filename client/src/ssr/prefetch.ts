import type { QueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { TRPCError, type inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";

export type HeadMeta = {
  title: string;
  description: string;
  canonicalPath?: string;
  ogType?: "website" | "article";
  ogImage?: string;
  noindex?: boolean;
  notFound?: boolean;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  alternates?: Array<{ locale: string; path: string }>;
};

type Outputs = inferRouterOutputs<AppRouter>;
export type SsrPrefetch = {
  home: () => Promise<Outputs["directory"]["home"]>;
  listingBySlug: (slug: string) => Promise<Outputs["directory"]["listingBySlug"]>;
  articleBySlug: (slug: string) => Promise<Outputs["directory"]["articleBySlug"]>;
  cityBySlug: (slug: string) => Promise<Outputs["directory"]["cityBySlug"]>;
  countryBySlug: (code: string) => Promise<Outputs["directory"]["countryBySlug"]>;
};

const SITE = "Quiet Hour";
const DEFAULT_DESCRIPTION = "A considered guide to wellness places, rituals, and city intelligence.";

function seeded(queryClient: QueryClient, key: unknown, value: unknown) {
  (queryClient as any).setQueryData(key, value);
}

async function genuineMiss<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

export async function prefetchForPath(url: string, queryClient: QueryClient, prefetch: SsrPrefetch): Promise<HeadMeta> {
  let rawPath = url.split("?")[0];
  try { rawPath = decodeURI(rawPath); } catch { /* preserve malformed path */ }
  const path = rawPath.replace(/\/+$/, "") || "/";
  const homeRoutes: Record<string, { title: string; description: string }> = {
    "/": { title: "Quiet Hour — Find your place in the city", description: DEFAULT_DESCRIPTION },
    "/directory": { title: "Wellness directory — Quiet Hour", description: "Explore independently listed wellness places by city, treatment, and the feeling you want to leave with." },
    "/journal": { title: "Wellness journal — Quiet Hour", description: "Practical pieces on mindfulness, massage, circulation, and feeling better in your body." },
  };
  if (homeRoutes[path]) {
    const data = await prefetch.home();
    seeded(queryClient, getQueryKey(trpc.directory.home, undefined, "query"), data);
    const jsonLd = path === "/" ? [{ "@context": "https://schema.org", "@type": "WebSite", name: SITE, url: "https://thaimassageforu.com/", description: DEFAULT_DESCRIPTION }, { "@context": "https://schema.org", "@type": "Organization", name: SITE, url: "https://thaimassageforu.com/", email: "hello@thaimassageforu.com" }] : { "@context": "https://schema.org", "@type": "CollectionPage", name: homeRoutes[path].title, description: homeRoutes[path].description, url: `https://thaimassageforu.com${path}` };
    return { ...homeRoutes[path], canonicalPath: path, jsonLd, alternates: [{ locale: "en", path }] };
  }
  if (path === "/list-your-place") {
    return { title: "List your wellness studio — Quiet Hour", description: "A considered listing for independent wellness studios, therapists, and recovery spaces.", canonicalPath: path, alternates: [{ locale: "en", path }] };
  }
  if (path === "/coming-soon") {
    return { title: "What we're building next — Quiet Hour", description: "AI booking, deposit collection, and more on the Quiet Hour roadmap.", canonicalPath: path, alternates: [{ locale: "en", path }] };
  }
  const country = path.match(/^\/(us|uk|au|de)$/);
  if (country) {
    const data = await genuineMiss(() => prefetch.countryBySlug(country[1]));
    if (!data) return { title: SITE, description: DEFAULT_DESCRIPTION, notFound: true };
    seeded(queryClient, getQueryKey(trpc.directory.countryBySlug, { code: country[1] }, "query"), data);
    return { title: `Wellness in ${data.country.name} — ${SITE}`, description: `${data.country.listingCount} independently listed wellness places across ${data.cities.length} cities in ${data.country.name}.`, canonicalPath: path, alternates: [{ locale: "en", path }], jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: `Wellness in ${data.country.name}`, url: `https://thaimassageforu.com${path}` } };
  }
  const city = path.match(/^\/city\/([^/]+)$/);
  if (city) {
    const data = await genuineMiss(() => prefetch.cityBySlug(city[1]));
    if (!data) return { title: SITE, description: DEFAULT_DESCRIPTION, notFound: true };
    seeded(queryClient, getQueryKey(trpc.directory.cityBySlug, { slug: city[1] }, "query"), data);
    return { title: `${data.city.name} wellness guide — ${SITE}`, description: data.city.introduction || `A considered guide to wellness places and city intelligence in ${data.city.name}.`, canonicalPath: path, alternates: [{ locale: data.city.primaryLocale, path }], jsonLd: { "@context": "https://schema.org", "@type": "TouristDestination", name: `${data.city.name} wellness guide`, description: data.city.introduction || `Wellness places and local context in ${data.city.name}.`, url: `https://thaimassageforu.com${path}` } };
  }
  const listing = path.match(/^\/listing\/([^/]+)$/);
  if (listing) {
    const data = await genuineMiss(() => prefetch.listingBySlug(listing[1]));
    if (!data) return { title: SITE, description: DEFAULT_DESCRIPTION, notFound: true };
    seeded(queryClient, getQueryKey(trpc.directory.listingBySlug, { slug: listing[1] }, "query"), data);
    // The deployed Worker's getListing returns contact/geo fields the shared server router types don't know about yet.
    const rich = data.listing as typeof data.listing & { phone?: string | null; lat?: number | null; lon?: number | null };
    const business: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "HealthAndBeautyBusiness",
      name: data.listing.name,
      description: data.listing.descriptor || data.listing.description || undefined,
      url: `https://thaimassageforu.com${path}`,
      image: data.listing.imageUrl || undefined,
    };
    if (data.listing.address) business.address = { "@type": "PostalAddress", streetAddress: data.listing.address, addressLocality: data.city.name, addressCountry: data.city.countryCode?.toUpperCase() };
    if (rich.phone) business.telephone = rich.phone;
    if (typeof rich.lat === "number" && typeof rich.lon === "number") business.geo = { "@type": "GeoCoordinates", latitude: rich.lat, longitude: rich.lon };
    const breadcrumbs = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Quiet Hour", item: "https://thaimassageforu.com/" },
        { "@type": "ListItem", position: 2, name: data.city.name, item: `https://thaimassageforu.com/city/${data.city.slug}` },
        { "@type": "ListItem", position: 3, name: data.listing.name, item: `https://thaimassageforu.com${path}` },
      ],
    };
    return { title: `${data.listing.name} — massage & wellness in ${data.city.name} — ${SITE}`, description: data.listing.descriptor || data.listing.description || `Find ${data.listing.name} in the Quiet Hour directory.`, canonicalPath: path, alternates: [{ locale: data.city.primaryLocale, path }], ogImage: data.listing.imageUrl || undefined, jsonLd: [business, breadcrumbs] };
  }
  const article = path.match(/^\/journal\/([^/]+)$/);
  if (article) {
    const data = await genuineMiss(() => prefetch.articleBySlug(article[1]));
    if (!data) return { title: SITE, description: DEFAULT_DESCRIPTION, notFound: true };
    seeded(queryClient, getQueryKey(trpc.directory.articleBySlug, { slug: article[1] }, "query"), data);
    return { title: `${data.title} — ${SITE}`, description: data.excerpt || DEFAULT_DESCRIPTION, canonicalPath: path, alternates: [{ locale: "en", path }], ogType: "article", ogImage: data.coverImageUrl || undefined, jsonLd: { "@context": "https://schema.org", "@type": "Article", headline: data.title, description: data.excerpt || DEFAULT_DESCRIPTION, image: data.coverImageUrl || undefined, mainEntityOfPage: `https://thaimassageforu.com${path}`, publisher: { "@type": "Organization", name: SITE } } };
  }
  if (path === "/cms" || path.startsWith("/cms/")) return { title: "Quiet Hour CMS", description: "Quiet Hour management workspace.", noindex: true };
  if (path === "/my-listing") return { title: "Manage your listing — Quiet Hour", description: "Claim and update your listing on Quiet Hour.", canonicalPath: path, noindex: true };
  if (path === "/claim") return { title: "Claim your listing — Quiet Hour", description: "Find your business and claim it — a one-time code, no account to set up.", canonicalPath: path, noindex: true };
  return { title: SITE, description: DEFAULT_DESCRIPTION, notFound: true };
}
