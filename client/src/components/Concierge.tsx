import { useEffect } from "react";

/**
 * §7 of the concierge build brief: "React host (Quiet Hour): also export <Concierge /> wrapper
 * that just injects the script tag — avoid dual-bundling React." The widget itself is a plain
 * IIFE (packages/widget) with its own Shadow DOM — this component's only job is to make sure
 * the script tag exists exactly once, without pulling any of the widget's code into this
 * bundle. P0 scope: mounted on /city/:slug and /listing/:slug only (see CityGuide.tsx,
 * ListingDetail.tsx) — not site-wide yet.
 */
export function Concierge() {
  useEffect(() => {
    if (document.getElementById("concierge-script")) return;
    const script = document.createElement("script");
    script.id = "concierge-script";
    script.src = "/concierge/concierge.js";
    script.dataset.site = "quiet-hour";
    script.dataset.index = "/concierge";
    script.defer = true;
    document.body.appendChild(script);
  }, []);
  return null;
}
