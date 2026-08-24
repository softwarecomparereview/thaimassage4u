/**
 * Thai Massage For U — Android/iOS app
 * Reads live from https://thaimassageforu.com/api/v1 — no bundled data.
 */
import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./src/navigation/types";
import CountriesScreen from "./src/screens/CountriesScreen";
import CitiesScreen from "./src/screens/CitiesScreen";
import ListingsScreen from "./src/screens/ListingsScreen";
import ListingDetailScreen from "./src/screens/ListingDetailScreen";
import SearchScreen from "./src/screens/SearchScreen";
import { colors } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bgSoft,
    text: colors.text,
    border: colors.line,
    primary: colors.brand,
  },
};

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.bgSoft },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "700" },
          }}
        >
          <Stack.Screen name="Countries" component={CountriesScreen} options={{ title: "Thai Massage For U" }} />
          <Stack.Screen name="Cities" component={CitiesScreen} />
          <Stack.Screen name="Listings" component={ListingsScreen} />
          <Stack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: "" }} />
          <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Search" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
