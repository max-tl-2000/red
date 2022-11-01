#!/bin/bash
set -e

# added so jenkins doesn't move out from workspace directory
if [[ -z "${CONTINUOUS_INTEGRATION}" ]]; then
	# move into red directory
	cd "$(cd "$(dirname "$0")"; pwd)" && cd ..
fi

. ./_common.sh

log 'running tests'

./configure -p

./nvm-load.sh use

# this task will not use coverage when running in jenkins
# so no check is needed here
log 'running client unit tests'
npm run client-unit-test
log 'running server unit tests'
npm run server-unit-test

log 'tests completed'
