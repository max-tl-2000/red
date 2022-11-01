#!/bin/bash
SCRIPT_NAME="cucumber-test.sh"
VERSION="0.3.1"

LOCAL_ENV="local"
TEST_ENV="test"
ENV=$LOCAL_ENV

SERVICE="red"
SERVICE_PREFIX=""
RENTAPP_PREFIX="rentapp:"
RESEXP_PREFIX="resexp:"

TIMEOUT_DURATION="19m"
KILL_DURATION="22m"
TIMEOUT_EXIT_STATUS="124" # see manpage for timeout

DB_IMAGE_NAME=""

IS_PR=false
USE_CONTAINER=false
PR_TAG_FLAG="--tags @PR"
NO_FAIL_FAST_FLAG="--noFailFast"
USE_CONTAINER_FLAG="--useContainer"

function print_version {
  echo "Red run cucumber tests script $VERSION"
  exit 0
}

function print_help_hint {
  echo "See '$SCRIPT_NAME --help'."
}

function print_invalid_flag {
  echo "flag provided but not defined: $1"
  print_help_hint
  exit 2
}

function print_invalid_command {
  echo "command provided but not defined: $1"
  print_help_hint
  exit 2
}

function print_help {
  echo "Usage: $SCRIPT_NAME red|rentapp|resexp [OPTIONS]" ; echo
  echo "Red run cucumber test suite script." ; echo
  echo "Options:" ; echo
  echo " --coredb-tests  Run cucumber test suite on test machine"
  echo " --pr-test       Run pull request cucumber test suite"
  echo " --use-container Run cucumber tests in containerized browser"
  echo " -h, --help      Print usage"
  echo " -v, --version   Print version information" ; echo
  echo "Usage Example:" ; echo
  echo " Run red cucumber tests locally:"
  echo " ./cucumber-test.sh" ; echo
  echo " Run red cucumber tests on test machine:"
  echo " ./cucumber-test.sh --coredb-tests" ; echo
  exit 0
}

function get_test_opts {
  local readonly no_opts=" -- "
  local opts=$no_opts

  if $USE_CONTAINER ; then
    opts="$opts $USE_CONTAINER_FLAG"
  fi

  if [[ "$IS_PR" == "false" && "$ENV" != "$LOCAL_ENV" ]]; then
    opts="$opts $NO_FAIL_FAST_FLAG"
  fi

  opts="$opts -- "
  if $IS_PR ; then opts="$opts $PR_TAG_FLAG" ; fi

  echo $opts
}

# Script execution starts here
while [[ $# > 0 ]]; do
  key="$1"

  case $key in
    red)
    ;;
    --coredb-tests)
      ENV=$TEST_ENV
    ;;
    --pr-test)
      IS_PR=true
    ;;
    --use-container)
      USE_CONTAINER=true
    ;;
    -t|--timeout)
      echo ">>>> Overriding default timeout from $TIMEOUT_DURATION to $2"
      TIMEOUT_DURATION=$2
      shift
    ;;
    -d|--db-image-name)
      echo ">>>> setting container db name to $2"
      DB_IMAGE_NAME=$2
      shift
    ;;
    -k|--kill-timeout)
      echo ">>>> Overriding default kill timeout from $KILL_DURATION to $2"
      KILL_DURATION=$2
      shift
    ;;
    -v|--version)
       print_version
    ;;
    -h|--help)
      print_help
    ;;
    *)
      print_invalid_flag "$1"
    ;;
  esac

  shift
done # end while

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

. ./nvm-load.sh

nvm install v8.12.0
nvm use v8.12.0

LOCAL_TEST_CMD="npm run ${SERVICE_PREFIX}cucumber-local $(get_test_opts)"
TEST_CMD="npm run ${SERVICE_PREFIX}cucumber-report-test $(get_test_opts)"

echo ">>>> running $SERVICE cucumber tests on $ENV env"

export COREDB_CONTAINER_NAME="${DB_IMAGE_NAME}";

echo ">>>> coredb image name ${COREDB_CONTAINER_NAME}"

if [[ "$ENV" == "$LOCAL_ENV" ]] ; then
  $LOCAL_TEST_CMD
elif [[ "$ENV" == "$TEST_ENV" ]] ; then
  set -x
  echo ">>>> Test will aborted if not completed in $TIMEOUT_DURATION"
  timeout -k $KILL_DURATION $TIMEOUT_DURATION $TEST_CMD
  TEST_RC=$?
  if [ "$TEST_RC" = "$TIMEOUT_EXIT_STATUS" ] ; then
    echo ">>>> timeout of $TIMEOUT_DURATION was exceeded;  test has been killed"
  fi
  echo ">>>>cucumber exited with exit code $TEST_RC"

  set +e

  hash bunyan-filter 2>/dev/null;

  if [ $? -eq 1 ]; then
    echo "bunyan-filter not found. Installing it"
    npm i -g @redisrupt/bunyan-filter
  fi

  bunyan-filter --globs='./logs/*.log' --level=50

  set -e

  exit $TEST_RC
fi
