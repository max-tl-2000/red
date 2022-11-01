#!/bin/bash
set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME='initial-setup'

. ./nvm-load.sh

if test "$1" = "--check"; then
  babel-node --extensions '.ts,.js,.json' server/database/check-migrations.js
else
  babel-node --extensions '.ts,.js,.json' server/setup/migrate_schema.js
fi
