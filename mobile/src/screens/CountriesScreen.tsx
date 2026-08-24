import React from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { listCountries, type Country } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { LoadingView, ErrorView } from "../components/StateViews";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Countries">;

export default function CountriesScreen({ navigation }: Props) {
  const { data, loading, error, refetch } = useAsync(() => listCountries(), []);

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refetch} />;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Thai Massage For U</Text>
        <Text style={styles.subtitle}>Quiet Hour · real studios, four countries</Text>
        <TouchableOpacity style={styles.searchButton} onPress={() => navigation.navigate("Search")}>
          <Text style={styles.searchButtonText}>Search a city or studio →</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={data?.countries ?? []}
        keyExtractor={(item) => item.code}
        refreshing={loading}
        onRefresh={refetch}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <CountryCard country={item} onPress={() => navigation.navigate("Cities", { countryCode: item.code, countryName: item.name })} />}
      />
    </View>
  );
}

function CountryCard({ country, onPress }: { country: Country; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: country.imageUrl }} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>
          {country.flag} {country.name}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {country.tagline}
        </Text>
        <Text style={styles.cardMeta}>{country.listingCount} studios</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: spacing.xs, textTransform: "uppercase", letterSpacing: 1 },
  searchButton: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  searchButtonText: { color: colors.textLight, fontWeight: "600" },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
  },
  cardImage: { width: "100%", height: 140 },
  cardBody: { padding: spacing.lg },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.muted, marginTop: spacing.xs },
  cardMeta: { fontSize: 13, color: colors.brand, fontWeight: "700", marginTop: spacing.sm },
});
