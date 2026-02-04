#!/bin/bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists."
  exit 1
fi

echo "Creating signed tag ${TAG} for version ${VERSION}..."
git tag -s "$TAG" -m "Release ${VERSION}"

echo "Signed tag created. Push with: git push origin ${TAG}"
