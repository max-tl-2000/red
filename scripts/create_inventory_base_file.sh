#!/bin/sh

set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=create-inventory-base

. ./nvm-load.sh

INPUT=${1:-server/import/__tests__/resources/Inventory.xlsx}
OUTPUT_PATH=${2:-server/import/resources}
echo "Creating base import file InventoryBase.xlsx based on "$INPUT
babel-node  --extensions '.ts,.js,.json' server/import/create-inventory-base-file.js $INPUT $OUTPUT_PATH
