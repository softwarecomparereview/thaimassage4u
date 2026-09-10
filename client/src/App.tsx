import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import About from "@/pages/About";
import ArticleDetail from "@/pages/ArticleDetail";
import CityGuide from "@/pages/CityGuide";
import ClaimSearch from "@/pages/ClaimSearch";
import Contact from "@/pages/Contact";
import CountryGuide from "@/pages/CountryGuide";
import Cms from "@/pages/Cms";
import ComingSoon from "@/pages/ComingSoon";
import Directory from "@/pages/Directory";
import Journal from "@/pages/Journal";
import ListingDetail from "@/pages/ListingDetail";
import ListYourPlace from "@/pages/ListYourPlace";
import MyListing from "@/pages/MyListing";
import Privacy from "@/pages/Privacy";
import Supplies from "@/pages/Supplies";
import Terms from "@/pages/Terms";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { trackPageView } from "./lib/analytics";
import Home from "./pages/Home";

/**
 * gtag's automatic page_view (worker/ssr.tsx's GTAG_SNIPPET has send_page_view disabled) only
 * ever fires once per full page load, which for a client-routed SPA means every in-app
 * navigation after the first would be invisible in GA. This fires one on mount (covering the
 * first, server-rendered route) and again on every location change thereafter.
 */
function RouteTracker() {
  const [location] = useLocation();
  useEffect(() => {
    trackPageView(location);
  }, [location]);
  return null;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/directory"} component={Directory} />
      <Route path={"/us"} component={CountryGuide} />
      <Route path={"/uk"} component={CountryGuide} />
      <Route path={"/au"} component={CountryGuide} />
      <Route path={"/de"} component={CountryGuide} />
      <Route path={"/ca"} component={CountryGuide} />
      <Route path={"/nz"} component={CountryGuide} />
      <Route path={"/ie"} component={CountryGuide} />
      <Route path={"/ae"} component={CountryGuide} />
      <Route path={"/city/:slug"} component={CityGuide} />
      <Route path={"/listing/:slug"} component={ListingDetail} />
      <Route path={"/journal"} component={Journal} />
      <Route path={"/journal/:slug"} component={ArticleDetail} />
      <Route path={"/list-your-place"} component={ListYourPlace} />
      <Route path={"/coming-soon"} component={ComingSoon} />
      <Route path={"/my-listing"} component={MyListing} />
      <Route path={"/claim"} component={ClaimSearch} />
      <Route path={"/supplies"} component={Supplies} />
      <Route path={"/:code/supplies"} component={Supplies} />
      <Route path={"/cms"} component={Cms} />
      <Route path={"/cms/:section"} component={Cms} />
      <Route path={"/about"} component={About} />
      <Route path={"/contact"} component={Contact} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <RouteTracker />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
