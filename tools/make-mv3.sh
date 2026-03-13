#!/usr/bin/env bash
#
# This script assumes a linux environment

set -e
shopt -s extglob

echo "*** uBOLite.mv3: Creating extension"

PLATFORM="chromium"

for i in "$@"; do
  case $i in
    full)
      FULL="yes"
      ;;
    firefox)
      PLATFORM="firefox"
      ;;
    chromium)
      PLATFORM="chromium"
      ;;
    edge)
      PLATFORM="edge"
      ;;
    safari)
      PLATFORM="safari"
      ;;
    +([0-9]).+([0-9]).+([0-9]))
      TAGNAME="$i"
      FULL="yes"
      ;;
  esac
done

echo "PLATFORM=$PLATFORM"

UBOL_DIR="dist/build/uBOLite.$PLATFORM"

if [ "$PLATFORM" = "edge" ]; then
    MANIFEST_DIR="chromium"
else
    MANIFEST_DIR="$PLATFORM"
fi

rm -rf "$UBOL_DIR"
mkdir -p "$UBOL_DIR"

echo "*** uBOLite.mv3: Copying extension files"
cp -R extension/. "$UBOL_DIR"/

echo "*** uBOLite.mv3: Copying platform manifest"
cp "$MANIFEST_DIR/manifest.json" "$UBOL_DIR"/

# Platform-specific extra files
if [ "$PLATFORM" = "safari" ]; then
    cp safari/ext-compat.js     "$UBOL_DIR/js/" 2>/dev/null || :
    cp safari/css-api.js        "$UBOL_DIR/js/scripting/" 2>/dev/null || :
    cp safari/css-user.js       "$UBOL_DIR/js/scripting/" 2>/dev/null || :
fi

cp LICENSE.txt "$UBOL_DIR"/

echo "*** uBOLite.$PLATFORM: extension ready"
echo "Extension location: $UBOL_DIR/"

# Set version in manifest
tmp_manifest=$(mktemp)
chmod '=rw' "$tmp_manifest"
if [ -z "$TAGNAME" ]; then
    TAGNAME="$(jq -r .version "$UBOL_DIR"/manifest.json)"
else
    jq --arg version "${TAGNAME}" '.version = $version' "$UBOL_DIR/manifest.json" \
        > "$tmp_manifest" && mv "$tmp_manifest" "$UBOL_DIR/manifest.json"
fi

# Platform-specific patches
if [ "$PLATFORM" = "edge" ]; then
    echo "*** uBOLite.edge: Applying Edge patch"
    node edge/patch-extension.js packageDir="$UBOL_DIR"
elif [ "$PLATFORM" = "safari" ]; then
    echo "*** uBOLite.safari: Applying Safari patch"
    node safari/patch-extension.js packageDir="$UBOL_DIR"
fi

if [ "$FULL" = "yes" ]; then
    EXTENSION="zip"
    if [ "$PLATFORM" = "firefox" ]; then
        EXTENSION="xpi"
    fi
    echo "*** uBOLite.mv3: Creating publishable package..."
    UBOL_PACKAGE_NAME="uBOLite_$TAGNAME.$PLATFORM.$EXTENSION"
    UBOL_PACKAGE_DIR=$(mktemp -d)
    cp -R "$UBOL_DIR"/. "$UBOL_PACKAGE_DIR"/
    cd "$UBOL_PACKAGE_DIR" > /dev/null
    rm -f ./log.txt
    zip "$UBOL_PACKAGE_NAME" -qr ./*
    cd - > /dev/null
    cp "$UBOL_PACKAGE_DIR/$UBOL_PACKAGE_NAME" dist/build/
    rm -rf "$UBOL_PACKAGE_DIR"
    echo "Package location: $(pwd)/dist/build/$UBOL_PACKAGE_NAME"
fi
