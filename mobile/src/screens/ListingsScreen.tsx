import React from "react";
import { FlatList } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { listListings } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { LoadingView, ErrorView, EmptyView } from "../components/StateViews";
import { ListingCard } from "../components/ListingCard";
import { colors, spacing } from "../theme";
import { StyleSheet } from "react-native";

type Props = NativeStackScreenProps<RootStackParamList, "Listings">;

export default function ListingsScreen({ route, navigation }: Props) {
  const { countryCode, citySlug, cityName } = route.params;
  const { data, loading, error, refetch } = useAsync(() => listListings(countryCode, citySlug), [countryCode, citySlug]);

  React.useEffect(() => {
    navigation.setOptions({ title: cityName });
  }, [navigation, cityName]);

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refetch} />;
  if (data && data.listings.length === 0) return <EmptyView message="No listings yet for this city." />;

  return (
    <FlatList
      style={styles.screen}
      data={data?.listings ?? []}
      keyExtractor={(item) => item.slug}
      refreshing={loading}
      onRefresh={refetch}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <ListingCard listing={item} onPress={() => navigation.navigate("ListingDetail", { slug: item.slug, name: item.name })} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg },
});
