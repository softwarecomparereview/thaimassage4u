# SEO Route Validation

## Contextual internal linking

The public route set is intentionally connected rather than operating as isolated search landing pages. The home page links into the directory, journal, partner page, city guides, premium listing records, and individual articles. The directory and city pages route visitors between global discovery and city context; listing and article detail pages provide return routes to their parent collections. The partner page routes providers into the authenticated CMS and the premium placement controls.

| Route family | Verified navigation paths |
| --- | --- |
| Home | Directory, journal, city guides, listings, articles, partner listing page |
| Directory | Listing detail, shared site navigation, route footer |
| City guide | Directory and contextual listing cards, verified event sources |
| Listing detail | Directory return path and direct booking destination when provided |
| Journal | Individual article routes |
| Article detail | Journal return path |
| Partner page | CMS workspace and premium tier entry points |

The directory page renders each published result through `DirectoryPlaceCard`; that card uses the internal route `/listing/{slug}`. This completes the discovery-to-detail internal-link path for the directory itself.

## Locale-reference stance

Every currently indexed English route emits a self-referencing `hreflang="en"` alternate. City and listing pages emit the city’s actual `primaryLocale`, so a Thai city can accurately declare `en-TH` before translated variants are available. The system deliberately does **not** create reciprocal alternate links to routes that do not exist. When a translated page is approved and published in the CMS, add a routable locale variant and emit reciprocal alternates only among the complete published set.

## Automated coverage

The SSR verification script covers canonical routes, server-rendered public body content, noindex CMS delivery, and 404 output. The route metadata path was additionally verified by requesting `/journal` as a crawler and confirming `hreflang="en"` in the delivered HTML.
