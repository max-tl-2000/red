#!/bin/sh
set -e

if [ -z "$1" ]
then
 echo "Tenant name needed"
 echo "Usage example: ./scripts/link_renewal_v1_to_active_lease.sh %tenantName%"
 exit 1
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=link_renewal_v1_to_active_lease

. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' server/workers/party/linkRenewalV1ToActiveLease.js "$1" "$2"