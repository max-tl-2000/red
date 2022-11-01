#!/bin/bash

set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH

ACCOUNT_NAME=${1}
TENANT='red'
PROPERTY_NAME='swparkme'

function process_unknown_flag {
  flag="$1"
  case $flag in -*|--*)
    echo "flag provided but not defined: $flag"
    exit 2
  esac
}

# process options
while [[ $# > 0 ]]; do
  key="$1"
  case $key in
    -t|--tenant)
      TENANT="$2"
    ;;
    -p|--property)
      PROPERTY_NAME="$2"
    ;;
    *)
      process_unknown_flag "$1"
    ;;
  esac

  shift
done # end while

babel-node server/payment/cli.js --accountName "$ACCOUNT_NAME" --tenantName "$TENANT" --propertyName "$PROPERTY_NAME"
