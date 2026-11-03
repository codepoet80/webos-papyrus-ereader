#!/bin/bash
# Usage:
#   ./build.sh            bump build number, package webOS .ipk (default)
#   ./build.sh android    bump build number, build Android debug .apk
#   ./build.sh all        bump once, build both
#   add --release         Android: signed release build (needs build.json, see README)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

SW_FILE="app/serviceworker.js"
MAIN_FILE="app/app/Main.js"
WRAPPER="$SCRIPT_DIR/cordova-wrapper"
ANDROID_JAVA="17.0.13-tem"

webos=0; android=0; release=""
for arg in "$@"; do
    case "$arg" in
        webos)     webos=1 ;;
        android)   android=1 ;;
        all)       webos=1; android=1 ;;
        --release) release="--release" ;;
        *) echo "Unknown argument: $arg (expected webos | android | all | --release)" >&2; exit 1 ;;
    esac
done
[ $webos -eq 0 ] && [ $android -eq 0 ] && webos=1

# Extract current build number from service worker
CURRENT=$(grep -o "papyrus-v[0-9]*" "$SW_FILE" | grep -o "[0-9]*$")
if [ -z "$CURRENT" ]; then
    echo "Error: could not find build number in $SW_FILE" >&2
    exit 1
fi

NEXT=$((CURRENT + 1))
echo "Bumping build: v$CURRENT → v$NEXT"

# Update serviceworker.js
sed -i '' "s/papyrus-v${CURRENT}/papyrus-v${NEXT}/g" "$SW_FILE"

# Update Main.js display string
sed -i '' "s/(build v${CURRENT})/(build v${NEXT})/g" "$MAIN_FILE"

echo "Updated $SW_FILE and $MAIN_FILE"

if [ $webos -eq 1 ]; then
    # Package the webOS app
    echo "Packaging webOS app..."
    palm-package app

    IPK=$(ls -t com.palm.codepoet.papyrus_*.ipk 2>/dev/null | head -1)
    if [ -n "$IPK" ]; then
        echo "Built: $IPK"
    else
        echo "Warning: .ipk not found after packaging"
    fi
fi

if [ $android -eq 1 ]; then
    echo "Building Android app..."

    # Cordova-android 14 needs JDK 17; palm-package needs JDK 8. The webOS
    # step above has already run, so switching here can't affect it.
    if [ -d "$HOME/.sdkman/candidates/java/$ANDROID_JAVA" ]; then
        export JAVA_HOME="$HOME/.sdkman/candidates/java/$ANDROID_JAVA"
    elif JH=$(/usr/libexec/java_home -v 17 2>/dev/null); then
        export JAVA_HOME="$JH"
    else
        echo "Error: JDK 17 not found (try: sdk install java $ANDROID_JAVA)" >&2
        exit 1
    fi
    export PATH="$JAVA_HOME/bin:$PATH"
    export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
    echo "Using $(java -version 2>&1 | head -1) at $JAVA_HOME"

    VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' app/appinfo.json | head -1)
    # Keep the APK's versionName in step with appinfo.json, and use the build
    # number as versionCode so every APK installs over the previous one.
    sed -i '' -E \
        -e "s/(<widget [^>]*) version=\"[^\"]*\"/\1 version=\"$VERSION\"/" \
        -e "s/ android-versionCode=\"[0-9]*\"//" \
        -e "s/(<widget [^>]*) version=/\1 android-versionCode=\"$NEXT\" version=/" \
        "$WRAPPER/config.xml"

    cd "$WRAPPER"
    [ -d node_modules/cordova-android ] || npm install

    # Fresh www from app/ (the app has no build step; it ships as-is), minus
    # the service worker, which the APK doesn't use.
    rm -rf www && mkdir www
    cp -R "$SCRIPT_DIR/app/." www/
    rm -f www/serviceworker.js
    # Load cordova.js first so window.cordova exists for the SW guard and any
    # later Android-specific code.
    sed -i '' 's#<script src="enyo/enyo.js"#<script src="cordova.js" type="text/javascript"></script>\
	<script src="enyo/enyo.js"#' www/index.html
    grep -q 'src="cordova.js"' www/index.html || { echo "Error: failed to inject cordova.js" >&2; exit 1; }

    # Platform add is skipped when already present; delete platforms/ to reset
    # (e.g. after changing config.xml plugins or the app id).
    [ -d platforms/android ] || npx cordova platform add android
    npx cordova build android $release

    mkdir -p "$SCRIPT_DIR/bin"
    rm -f "$SCRIPT_DIR"/bin/papyrus-*.apk "$SCRIPT_DIR"/bin/papyrus-*.aab
    if [ -n "$release" ]; then
        cp platforms/android/app/build/outputs/bundle/release/*.aab "$SCRIPT_DIR/bin/papyrus-$VERSION-v$NEXT-release.aab" 2>/dev/null || true
        cp platforms/android/app/build/outputs/apk/release/*.apk "$SCRIPT_DIR/bin/papyrus-$VERSION-v$NEXT-release.apk" 2>/dev/null || true
    else
        cp platforms/android/app/build/outputs/apk/debug/app-debug.apk "$SCRIPT_DIR/bin/papyrus-$VERSION-v$NEXT-debug.apk"
    fi
    echo "Built:"; ls -1 "$SCRIPT_DIR"/bin/papyrus-*
fi
