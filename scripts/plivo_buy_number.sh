#!/bin/sh

set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=plivo-buy

. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/workers/communication/plivo-buy-number.js "$1"
