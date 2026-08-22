import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Listing } from "../api/client";
import { colors, radius, spacing } from "../theme";

export function ListingCard({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: listing.imageUrl }} style={styles.image} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {listing.name}
          </Text>
          {listing.premium > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Featured</Text>
            </View>
          ) : null}
        </View>
        {listing.suburb ? <Text style={styles.suburb}>{listing.suburb}</Text> : null}
        <Text style={styles.services} numberOfLines={1}>
          {listing.services.join(" · ")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  image: { width: 96, height: 96 },
  body: { flex: 1, padding: spacing.md, justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontSize: 16, fontWeight: "700", color: colors.text, flexShrink: 1 },
  badge: { backgroundColor: colors.brandLight, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "800", color: colors.brandDark, textTransform: "uppercase" },
  suburb: { fontSize: 13, color: colors.muted, marginTop: 2 },
  services: { fontSize: 12, color: colors.brand, marginTop: spacing.xs, fontWeight: "600" },
});
