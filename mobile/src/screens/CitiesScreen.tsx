import React from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { listCities, type City } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { LoadingView, ErrorView, EmptyView } from "../components/StateViews";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Cities">;

export default function CitiesScreen({ route, navigation }: Props) {
  const { countryCode, countryName } = route.params;
  const { data, loading, error, refetch } = useAsync(() => listCities(countryCode), [countryCode]);

  React.useEffect(() => {
    navigation.setOptions({ title: countryName });
  }, [navigation, countryName]);

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refetch} />;
  if (data && data.cities.length === 0) return <EmptyView message="No cities yet for this country." />;

  return (
    <FlatList
      style={styles.screen}
      data={data?.cities ?? []}
      keyExtractor={(item) => item.slug}
      refreshing={loading}
      onRefresh={refetch}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <CityCard
          city={item}
          onPress={() => navigation.navigate("Listings", { countryCode: item.countryCode, citySlug: item.slug, cityName: item.name })}
        />
      )}
    />
  );
}

function CityCard({ city, onPress }: { city: City; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: city.imageUrl }} style={styles.cardImage} />
      <View style={styles.overlay} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{city.name}</Text>
        {city.region ? <Text style={styles.cardSubtitle}>{city.region}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    height: 140,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    justifyContent: "flex-end",
  },
  cardImage: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(16,22,16,0.35)" },
  cardBody: { padding: spacing.lg },
  cardTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  cardSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 },
});
