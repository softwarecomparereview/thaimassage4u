import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ArticleDetail from "@/pages/ArticleDetail";
import CityGuide from "@/pages/CityGuide";
import CountryGuide from "@/pages/CountryGuide";
import Cms from "@/pages/Cms";
import ComingSoon from "@/pages/ComingSoon";
import Directory from "@/pages/Directory";
import Journal from "@/pages/Journal";
import ListingDetail from "@/pages/ListingDetail";
import ListYourPlace from "@/pages/ListYourPlace";
import MyListing from "@/pages/MyListing";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

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
      <Route path={"/city/:slug"} component={CityGuide} />
      <Route path={"/listing/:slug"} component={ListingDetail} />
      <Route path={"/journal"} component={Journal} />
      <Route path={"/journal/:slug"} component={ArticleDetail} />
      <Route path={"/list-your-place"} component={ListYourPlace} />
      <Route path={"/coming-soon"} component={ComingSoon} />
      <Route path={"/my-listing"} component={MyListing} />
      <Route path={"/cms"} component={Cms} />
      <Route path={"/cms/:section"} component={Cms} />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
