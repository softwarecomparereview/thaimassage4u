import React from "react";
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getListing } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { LoadingView, ErrorView } from "../components/StateViews";
import { colors, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ListingDetail">;

export default function ListingDetailScreen({ route, navigation }: Props) {
  const { slug, name } = route.params;
  const { data, loading, error, refetch } = useAsync(() => getListing(slug), [slug]);

  React.useEffect(() => {
    navigation.setOptions({ title: name });
  }, [navigation, name]);

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={refetch} />;
  if (!data) return null;
  const listing = data.listing;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Image source={{ uri: listing.imageUrl }} style={styles.hero} />
      <View style={styles.body}>
        <Text style={styles.title}>{listing.name}</Text>
        {listing.suburb ? <Text style={styles.suburb}>{listing.suburb}</Text> : null}
        <View style={styles.chipRow}>
          {listing.services.map((service) => (
            <View key={service} style={styles.chip}>
              <Text style={styles.chipText}>{service}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.description}>{listing.description}</Text>

        {listing.address ? <InfoRow label="Address" value={listing.address} /> : null}
        {listing.hours ? <InfoRow label="Hours" value={listing.hours} /> : null}

        <View style={styles.actions}>
          {listing.phone ? (
            <ActionButton label={`Call ${listing.phone}`} onPress={() => Linking.openURL(`tel:${listing.phone!.replace(/\s+/g, "")}`)} primary />
          ) : null}
          {listing.website ? <ActionButton label="Open their site" onPress={() => Linking.openURL(listing.website!)} /> : null}
          {listing.freshaUrl ? <ActionButton label="Book on Fresha" onPress={() => Linking.openURL(listing.freshaUrl!)} /> : null}
          {listing.mapsUrl ? <ActionButton label="Open in Maps" onPress={() => Linking.openURL(listing.mapsUrl!)} /> : null}
        </View>

        {!listing.claimed && listing.source === "openstreetmap" ? (
          <Text style={styles.note}>Found on the public map. The studio can claim this page on the website to confirm hours and phone.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <TouchableOpacity style={[styles.actionButton, primary && styles.actionButtonPrimary]} onPress={onPress}>
      <Text style={[styles.actionButtonText, primary && styles.actionButtonTextPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
  hero: { width: "100%", height: 240 },
  body: { padding: spacing.lg },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  suburb: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  chip: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.textLight },
  description: { fontSize: 15, color: colors.textLight, lineHeight: 22, marginTop: spacing.lg },
  infoRow: { marginTop: spacing.lg },
  infoLabel: { fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700" },
  infoValue: { fontSize: 15, color: colors.text, marginTop: 2 },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
  actionButton: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center" },
  actionButtonPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  actionButtonText: { fontWeight: "700", color: colors.textLight },
  actionButtonTextPrimary: { color: "#fff" },
  note: { marginTop: spacing.lg, fontSize: 12, color: colors.muted, fontStyle: "italic" },
});
