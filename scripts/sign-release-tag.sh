#!/bin/bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install it and run: gh auth login"
  exit 1
fi

echo "Creating signed tag ${TAG} for version ${VERSION}..."
git tag -s "$TAG" -m "Release ${VERSION}"

PREV_TAG=$(git tag --list "v*" --sort=-v:refname | grep -v "^${TAG}$" | head -n 1 || true)
if [ -n "$PREV_TAG" ]; then
  CHANGELOG=$(git log "${PREV_TAG}..HEAD" --pretty=format:"- %s" )
else
  CHANGELOG=$(git log --pretty=format:"- %s")
fi

echo "Pushing tag ${TAG}..."
git push origin "${TAG}"

echo "Creating GitHub release ${TAG}..."
gh release create "${TAG}" --title "${TAG}" --notes "Release ${VERSION}\n\n${CHANGELOG}"

echo "Signed tag pushed and release created."
