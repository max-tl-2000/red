#!/bin/sh

set -e

if [ -z "$1" ] ; then
	echo "Filename not set."
  echo "Usage: ./create_migration_file.sh filename"
	exit 3
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

. ./nvm-load.sh

node_modules/.bin/babel-node --extensions '.ts,.js,.json' node_modules/knex/bin/cli.js migrate:make "$1" --knexfile ./server/database/knexfile-create-migration-file.js
