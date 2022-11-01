#!/bin/bash
set -e

#Usage:
#./scripts/updateContactInfos.sh

if [ -z "$1" ]
then
 echo ""
 echo "Usage example: ./scripts/updateContactInfos.sh maximus"
 exit 1
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME='update-contact_infos'

. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/services/contactInfoEnhancer.js "$1"
