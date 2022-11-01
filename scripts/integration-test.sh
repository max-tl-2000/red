#!/bin/bash
# pass --noSkip to this script so integration tests
# are executed regardless of files changing or not
# ./integration-test.sh --noSkip
set -e
echo ">>>> running integration tests"

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

. ./nvm-load.sh

export RED_LOG_LEVEL='debug'
export BABEL_DISABLE_CACHE=true

npm run integration-test-report -- $@
echo ">>>> finished integration tests"
