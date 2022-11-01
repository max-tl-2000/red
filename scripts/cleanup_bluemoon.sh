#!/bin/bash
set -e

#Usage:
#./scripts/cleanup_bluemoon.sh {emailMatcherRegexp} {residentNameToSearchFor}
#regexp example: ./scripts/cleanup_bluemoon.sh 'mircea.*@reva.tech'

#Please note that the {residentNameToSearchFor} is optional. If used, the process will go through all the leases and try to match the given name against the residents names for each lease.
#If matched those leases will be deleted.
#The process will take approximately 5 minutes if name is used.

if [ -z "$1" ]
then
 echo ""
 echo "Usage example: ./scripts/cleanup_bluemoon.sh %mailRegex% %residentNameToMatch - OPTIONAL%"
 exit 1
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME='bluemoon-cleanup'

. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/services/leases/bluemoon/cleanup/cleanBluemoon.js $1 $2
