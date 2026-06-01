# Android Wrapper (Capacitor) - Setup and Release

This frontend is now wrapped with Capacitor for Android.

## Prerequisites

- Android Studio (latest stable)
- Android SDK installed from Android Studio
- JDK 17 or JDK 21 (recommended: 21)

Note: JDK 25 is too new for this Gradle/Android toolchain and can fail builds.

## What was added

- Capacitor dependencies in package.json
- Capacitor config: capacitor.config.json
- Native Android project: android/
- Helper npm scripts for sync/open workflow

## Daily development workflow

1. Build and sync web assets into Android:

```bash
cd frontend
npm run cap:sync
```

2. Open Android Studio:

```bash
npm run android:open
```

3. In Android Studio, run app on emulator/device.

## One-command sync + open

```bash
cd frontend
npm run android:sync:open
```

## Build release artifacts

### Option A: Android Studio (recommended)

- Open project with `npm run android:open`
- Build > Generate Signed Bundle / APK
- Choose:
  - Android App Bundle (AAB) for Play Store
  - APK for direct download

### Option B: Gradle CLI

```bash
cd frontend/android
./gradlew bundleRelease
./gradlew assembleRelease
```

Outputs:

- AAB: android/app/build/outputs/bundle/release/app-release.aab
- APK: android/app/build/outputs/apk/release/app-release.apk

## Troubleshooting

If Gradle fails with:

`Unsupported class file major version 69`

It means Java 25 is being used.

Fix:

1. Install JDK 21.
2. Point JAVA_HOME to JDK 21.
3. Re-run build.

Example:

```bash
export JAVA_HOME="/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
cd frontend/android
./gradlew assembleDebug
```

If Gradle fails with:

`SDK location not found`

Install SDK components and set local.properties:

```bash
mkdir -p "$HOME/Library/Android/sdk"
yes | sdkmanager --sdk_root="$HOME/Library/Android/sdk" --licenses
sdkmanager --sdk_root="$HOME/Library/Android/sdk" \
  "platform-tools" \
  "platforms;android-34" \
  "build-tools;34.0.0" \
  "cmdline-tools;latest"

cd frontend/android
printf 'sdk.dir=%s\n' "$HOME/Library/Android/sdk" > local.properties
```

## Important notes

- Every frontend change requires re-sync before Android build:

```bash
cd frontend
npm run cap:sync
```

- If plugin or native config changes, run sync again.
- Package ID currently set to: com.chefsync.restaurant

## Current app shell identity

- App name: ChefSync Restaurant
- App ID: com.chefsync.restaurant
- Web directory: dist
