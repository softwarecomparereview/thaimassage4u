# Thai Massage For U — mobile

Native Android app (bare React Native, **no Expo**). It reads live from the
same D1 data the website uses via `https://thaimassageforu.com/api/v1` (see
`src/api.ts` in the repo root for those endpoints). **No listing data is
bundled into the app** — when the website's data changes (new listings, a
studio claiming its page, an updated phone number), the app shows the change
on its next fetch. Only app *code* changes need a new build/release.

## Structure

```
mobile/
├── App.tsx                       # navigation shell
├── src/
│   ├── api/client.ts              # fetch wrapper for /api/v1 (countries, cities, listings, search)
│   ├── hooks/useAsync.ts          # small data-fetching hook used by every screen
│   ├── theme.ts                   # colors/spacing mirroring the website's "Quiet Hour" palette
│   ├── components/
│   │   ├── ListingCard.tsx
│   │   └── StateViews.tsx         # Loading / Error / Empty
│   ├── navigation/types.ts        # RootStackParamList
│   └── screens/
│       ├── CountriesScreen.tsx
│       ├── CitiesScreen.tsx
│       ├── ListingsScreen.tsx
│       ├── ListingDetailScreen.tsx
│       └── SearchScreen.tsx
├── android/                       # native Android project (bare RN, package com.thaimassageforu.app)
└── ios/                           # native iOS project (needs macOS + Xcode — see below)
```

## Running in development

```sh
npm install
npm start          # Metro bundler
npm run android     # in a second terminal, with a device/emulator connected
```

## Building a release APK

```sh
cd android
./gradlew assembleRelease
```

The signed APK is written to
`android/app/build/outputs/apk/release/app-release.apk`.

By default the release build is signed with the RN template's **debug**
keystore (`android/app/debug.keystore`), which is fine for sideloading and
testing but **not** for a Play Store submission. For a real release, generate
your own upload key and point `android/app/build.gradle`'s `signingConfigs`
at it:

```sh
keytool -genkeypair -v -keystore my-upload-key.keystore \
  -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Then set `MYAPP_UPLOAD_STORE_FILE` / `MYAPP_UPLOAD_KEY_ALIAS` /
`MYAPP_UPLOAD_STORE_PASSWORD` / `MYAPP_UPLOAD_KEY_PASSWORD` (via
`android/gradle.properties` or environment variables) and update the
`release` signing config in `android/app/build.gradle` to use them instead of
the debug keystore, then re-run `./gradlew assembleRelease`.

## iOS

The `ios/` project is scaffolded but has **not** been built or tested — that
requires an actual Mac with Xcode installed, which this environment does not
have. Once on a Mac:

```sh
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios
```

or open `ios/ThaiMassageForU.xcworkspace` in Xcode directly.

## Notes

- No Expo — this is a bare React Native project so it can ship a real
  compiled/signed APK, not just JS bundled through an Expo Go-style runtime.
- All listing data is fetched at runtime from the production API; nothing
  here needs to change when the website's data changes.
