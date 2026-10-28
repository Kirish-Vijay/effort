#!/usr/bin/env bash
# Build a new Effort for Android and publish it on the site. Phones with the app see an Update banner
# (it reads docs/app-version.json) and install the new build over the old one, keeping their account.
#
#   ./release-android.sh
#
# Needs the build tools in %LOCALAPPDATA%/effort-android-tools (Java 17, Gradle 8.13, Android SDK 36),
# android/release.jks and android/keystore-password.txt. Keep a copy of both: updates only install over
# builds signed with the same key.
set -euo pipefail
cd "$(dirname "$0")"
T="$LOCALAPPDATA/effort-android-tools"
export JAVA_HOME="$T/jdk/$(ls "$T/jdk" | head -1)" ANDROID_HOME="$T/sdk"
export PATH="$JAVA_HOME/bin:$T/gradle-8.13/bin:$PATH"

last=$(sed -E 's/.*"1\.([0-9]+)".*/\1/' docs/app-version.json)
export VERSION_CODE=$((last + 1))
export KEYSTORE_PASSWORD="$(tr -d '\r\n' < android/keystore-password.txt)"
echo "Building Effort for Android 1.$VERSION_CODE"
# Low-memory settings: this laptop runs out of RAM with Gradle's defaults while Chrome is open.
(cd android && GRADLE_OPTS="-Xmx256m" gradle assembleRelease --no-daemon --console=plain -q --max-workers=1   -Dorg.gradle.jvmargs="-Xmx1g -XX:MaxMetaspaceSize=512m -XX:+UseSerialGC" -Pkotlin.compiler.execution.strategy=in-process)

cp android/app/build/outputs/apk/release/app-release.apk docs/effort-steps.apk
printf '{ "version": "1.%s" }\n' "$VERSION_CODE" > docs/app-version.json
(cd docs && npx -y vercel@latest deploy --prod --yes >/dev/null)
echo "Published 1.$VERSION_CODE at https://effort-game.vercel.app/effort-steps.apk"
