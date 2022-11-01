#!/bin/sh

set -e

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

. ./nvm-load.sh

babel-node --extensions '.ts,.js,.json' ./resources/bin/decrypt.js --key=$1 --token=$2