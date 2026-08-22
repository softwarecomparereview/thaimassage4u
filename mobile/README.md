# Thai Massage For U — mobile

Native Android app (bare React Native, no Expo). Reads live from the same D1
data the website uses via `https://thaimassageforu.com/api/v1` — see
`src/api.ts` in the repo root for those endpoints. **No listing data is
bundled into the app** — when the website's data changes (new listings, a
claimed studio, a fixed phone number), the app shows it on next fetch. Only
app *code* changes need a new build/release.

## Structure

- `App.tsx` — navigation shell (React Navigation native-stack)
- `src/api/client.ts` — the only place the app talks to the network
- `src/screens/` — Countries → Cities → Listings → ListingDetail, plus Search
- `src/theme.ts` — mirrors the website's "Quiet Hour" palette (`public/styles.css`)

## Run it (Android)

Requires the Android SDK (`ANDROID_HOME` set, `platforms;android-37.1`,
`build-tools;37.0.0`, `ndk;27.1.12297006` — matches `android/build.gradle`).

```bash
cd mobile
npm install
npm run android          # builds + installs on a connected device/emulator, starts Metro
```

## Build a release APK yourself

```bash
cd mobile/android
./gradlew assembleRelease
# output: android/app/build/outputs/apk/release/app-release.apk
```

The release build is signed with the **debug** keystore for now (see
`android/app/build.gradle` — `signingConfig signingConfigs.debug` on the
release buildType). That's fine for sideloading/testing but **not** for a
real Play Store submission — before publishing, generate a real upload
keystore and switch the release signing config to it:

```bash
keytool -genkeypair -v -keystore my-upload-key.keystore -alias my-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

then follow React Native's [signed release guide](https://reactnative.dev/docs/signed-apk-android)
to wire that keystore into `android/gradle.properties` +
`android/app/build.gradle`.

## iOS

Not built yet — this environment has no macOS/Xcode, which iOS builds
require regardless of environment. The `ios/` folder this template
generated is untouched/unbuilt; the app code in `src/` and `App.tsx` is
already shared and platform-agnostic, so getting iOS running from here is
`cd ios && pod install`, open in Xcode, and build — on an actual Mac.
