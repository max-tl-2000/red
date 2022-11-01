#!/bin/bash
# enable bash fail-fast
set -e
. ./_common.sh

logBlock "Entering build.sh"

./configure.sh "$@"

. ./nvm-load.sh

if [ "$IMAGE_BUILDER" == "true" ]; then
  ./scripts/create_inventory_base_file.sh
fi

log 'Building static assets'
# Ensure that CLOUD_ENV is set as the build is running some tests
export CLOUD_ENV=build
npm run build
log 'Building static assets done'

if [ "$IMAGE_BUILDER" == "true" ]; then
  log 'copy thirdparty modules to static'
  ./bnr copy-npm-to-static
  log 'installing dependencies'
  ./bnr build-server --skipCucumber

  # clear the node_modules so we only end having the production
  # dependencies and not the dev dependencies
  rm -rf node_modules

  # old node_modules are linked inside red-dist
  # this is needed to support old node versions
  rm -rf ./red-dist/node_modules

  yarn install --prefer-offline --production;

  ./bnr link-modules --move
  log 'Installing dependencies done'
fi

log "Exiting build.sh"

