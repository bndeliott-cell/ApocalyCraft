#!/bin/bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag ${TAG} does not exist. Create it first with ./scripts/sign-release-tag.sh"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install it and run: gh auth login"
  exit 1
fi

FILES=(
  dist/*.AppImage
  dist/*.AppImage.sig
  dist/*.AppImage.sha256
  dist/*.AppImage.zsync
  dist/*.dmg
  dist/*.exe
  dist/*.blockmap
)

EXISTING=()
for f in "${FILES[@]}"; do
  for match in $f; do
    if [ -f "$match" ]; then
      EXISTING+=("$match")
    fi
  done
done

if [ ${#EXISTING[@]} -eq 0 ]; then
  echo "No release assets found in dist/."
  exit 1
fi

# Create release if it doesn't exist, then upload assets.
if ! gh release view "$TAG" >/dev/null 2>&1; then
  gh release create "$TAG" --title "$TAG" --notes "Release $VERSION"
fi

gh release upload "$TAG" "${EXISTING[@]}" --clobber

echo "Uploaded ${#EXISTING[@]} assets to release ${TAG}."
