#!/bin/sh

set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH

# default input values
RED_TENANT='red';
DEFAULT_ENDPOINT='dev1';

TENANT=${1:-$RED_TENANT}
ENDPOINT=${2:-$DEFAULT_ENDPOINT}

babel-node server/screening/cli.js --tenantName $TENANT --endPoint $ENDPOINT
