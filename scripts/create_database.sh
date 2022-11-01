#!/bin/bash
set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..
export RED_PROCESS_NAME='initial-setup'

. ./nvm-load.sh

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH

babel-node --extensions '.ts,.js,.json' ./server/database/seeds/BaseSchemaBuilder.js