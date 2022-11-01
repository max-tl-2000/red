#!/bin/sh
set -e

if [ -z "$1" ]
then
 echo "Tenant name needed"
 echo "Usage example: ./scripts/reassign_active_parties_to_dispatcher_inactive_users.sh %tenantName%"
 exit 1
fi


# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=reassign_active_parties_to_dispatcher_inactive_users
. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/workers/party/reassignActivePartiesToDispatcherForInactiveUsers.js "$1"
