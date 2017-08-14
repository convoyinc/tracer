#!/usr/bin/env bash
set -e

source ./scripts/include/node.sh

yarn run build

PACKAGE_XY=$(node -e "console.log(JSON.parse(fs.readFileSync('package.json')).version.replace(/\.\d+$/, ''))")
PACKAGE_VERSION="${PACKAGE_XY}.${CIRCLE_BUILD_NUM}"

echo "Releasing ${PACKAGE_VERSION}"
npm version "${PACKAGE_VERSION}"
git push --tags
npm publish
