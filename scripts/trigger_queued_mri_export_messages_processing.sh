#!/bin/sh
set -e

if [ -z "$1" ]
then
 echo "Tenant name needed"
 echo "Usage example: ./scripts/trigger_queued_mri_export_messages_processing.sh %tenantName% %{partyIds}% (to run only for some parties)"
 exit 1
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=trigger_queued_mri_export_messages_processing
. ./nvm-load.sh

if [ -z "$2" ]
then
 read -p "Are you sure you want to run this ? This script will trigger all the export messages for $1 tenant y/n " yn
 case $yn in
   [Yy]* ) babel-node --extensions '.ts,.js,.json' server/workers/party/processAllQueuedMriExportMessages.js "$1";;
   [Nn]* ) exit;;
   * ) echo "Please answer yes or no.";;
 esac
else
 babel-node --extensions '.ts,.js,.json' server/workers/party/processAllQueuedMriExportMessages.js "$1" "$2"
fi
