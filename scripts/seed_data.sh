#!/bin/sh

set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
RED_TENANT='red';

TENANT=${1:-$RED_TENANT}
INPUT=${2:-server/import/__tests__/resources/Inventory.xlsx}
OUTPUT=${3:-output.xlsx}

. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/import/cli.js $TENANT $INPUT $OUTPUT
