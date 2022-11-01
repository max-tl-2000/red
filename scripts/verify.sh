#!/bin/bash
set -e

cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

. ./_common.sh

logBlock "Running verify.sh"

logBlock "TARGET BRANCH: ${TARGET_GIT_BRANCH}"

export CONTINUOUS_INTEGRATION=true
export CLOUD_ENV=build;

export DISABLE_CONSOLE=true
export CI=true

./configure.sh --ci;

. ./nvm-load.sh

log "Running the checks"

npm run verify --silent;

logBlock "verify.sh done!"
