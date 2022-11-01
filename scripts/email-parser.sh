#!/bin/sh

set -e

if [ -z "$1" ]
then
 echo "file to use was not set"
 echo "Usage example: ./email-parser.sh mimeMessageFile"
 exit 1
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=emailParser
. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/workers/communication/aws/cli.js "$1"
