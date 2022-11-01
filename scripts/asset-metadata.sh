#!/bin/sh

set -e

if [ -z "$1" ]
then
 echo "The tenant name to use was not set"
 echo "Usage example: ./asset-metadata.sh tenantName"
 exit 1
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=assetMetadata
. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/workers/upload/cli.js "$1"
