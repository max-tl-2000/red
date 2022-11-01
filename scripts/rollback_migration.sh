#!/bin/sh

set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME='initial-setup'

. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/setup/rollback_migration.js
