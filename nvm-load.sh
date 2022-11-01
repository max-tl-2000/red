#!/bin/bash
set +e
. ./_versions.sh

NVM_COMMAND=$(command -v nvm);

if [[ "${NVM_COMMAND}" == "" ]]; then
  export NVM_DIR="$HOME/.nvm"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh" --no-use  # This loads nvm
  fi
  NVM_VERSION=$(nvm --version);

  echo "NVM version: ${NVM_VERSION}"
fi

nvm use $REQUIRED_NODE_VERSION
set -e