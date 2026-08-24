import React, { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { searchListings, type Listing } from "../api/client";
import { ListingCard } from "../components/ListingCard";
import { EmptyView } from "../components/StateViews";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Listing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { listings } = await searchListings(text.trim());
      setResults(listings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Try “Berlin” or a studio name"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={runSearch}
          autoFocus
          returnKeyType="search"
        />
        {loading ? <ActivityIndicator color={colors.brand} /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {results === null ? (
        <EmptyView message="Type at least 2 characters to search real studios." />
      ) : results.length === 0 ? (
        <EmptyView message="No studios matched. Try a city name." />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.slug}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListingCard listing={item} onPress={() => navigation.navigate("ListingDetail", { slug: item.slug, name: item.name })} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    margin: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
  },
  input: { flex: 1, paddingVertical: spacing.md, fontSize: 16, color: colors.text },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md },
  list: { padding: spacing.lg, paddingTop: 0 },
});
