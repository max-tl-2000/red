#!/bin/sh
set -e

if [ -z "$1" ]
then
 echo "Tenant name needed"
 echo "Usage example: ./scripts/copy_external_ids_inside_party_group.sh %tenantName%"
 exit 1
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=copy_external_ids_inside_party_group
. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/services/copyExternalIdInsidePartyGroups.js "$1"
