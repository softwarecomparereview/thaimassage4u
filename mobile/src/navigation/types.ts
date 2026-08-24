export type RootStackParamList = {
  Countries: undefined;
  Cities: { countryCode: string; countryName: string };
  Listings: { countryCode: string; citySlug: string; cityName: string };
  ListingDetail: { slug: string; name: string };
  Search: undefined;
};
