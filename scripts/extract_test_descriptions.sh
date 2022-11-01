#!/bin/sh

set -e

if [ -z "$1" ]
then
 echo "No test files were specified. Use files and/or folder paths separated by space."
 echo "Usage example: ./extract_test_descriptions.sh server/api/__integration__/comms server/services/__integration__/call-queue-test.js"
 exit 1
fi

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=plivo-cleanup

. ./nvm-load.sh

result=$(grep -rE "describe\(|it\(" "$@")

babel-node --extensions '.ts,.js,.json' resources/parse-test-descriptions.js "$result"
