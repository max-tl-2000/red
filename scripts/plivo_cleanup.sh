#!/bin/sh

set -e

if [ -z "$1" ]
then
 echo "name pattern to use for cleanup was not set"
 echo "Usage example: ./plivo_cleanup.sh cucumber"
 exit 1
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=plivo-cleanup

. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/workers/communication/plivo-cleanup.js "$1"
