#!/bin/sh
set -e

if [ -z "$1" ]
then
 echo "Tenant name needed"
 echo "Usage example: ./scripts/archive_workflows_without_extId_after_deployment.sh %tenantName%"
 exit 1
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=archive_workflows_without_extId_after_deployment
. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/workers/party/archiveWorkflowsWithoutExtIdAfterDeployment.js "$1"
