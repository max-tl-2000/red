#!/bin/sh
set -e

if [ -z "$1" ]
then
 echo "Tenant name needed"
 echo "Usage example: ./scripts/cancel_tasks_for_archived_parties.sh %tenantName%"
 exit 1
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=cancel_tasks_for_archived_parties
. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/workers/tasks/cancelTasksForArchivedParties.js "$1"