#!/bin/bash
set -e
SCRIPT_NAME="run.sh"
VERSION="0.0.5"
SLEEP="0"
SKIP_DATABASE_MIGRATIONS=false
CREATE_DATABASE=false
SCRIPTS_DIRECTORY="scripts"
MIGRATE_DATABASE_SCRIPT_NAME="migrate_database.sh"
CREATE_DATABASE_SCRIPT_NAME="create_database.sh"
MIGRATE_DATABASE_SCRIPT=$SCRIPTS_DIRECTORY/$MIGRATE_DATABASE_SCRIPT_NAME
CREATE_DATABASE_SCRIPT=$SCRIPTS_DIRECTORY/$CREATE_DATABASE_SCRIPT_NAME
ALL_SERVERS="all"
SERVERS=""
MIGRATE_DATABASE=false

function print_version {
	echo "Red run script $VERSION"
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

function print_help {
	echo "Usage: $SCRIPT_NAME [OPTIONS]" ; echo
	echo "Red run script." ; echo
	echo "Options:" ; echo
	echo " -e, --environment      Set run environment (loc|dev|test|prod...)"
	echo " -k, --skip-migrations  Do no run the database migrations. Only used in loc environment"
	echo " -c, --create-database	Create database and base schema"
	echo " -a, --all              Run all servers"
	echo " -s, --service          Run specific service leasing|api|socket|worker|auth|consumer|decision_api|export_api"
	echo " -m, --migrate          Run database migrations"
	echo " -h, --help             Print usage"
	echo " -v, --version          Print version information" ; echo
	exit 0
}

function migrate_database {
    if [ "${SKIP_DATABASE_MIGRATIONS}" == "false" ]; then
        echo ">>>> Running database migrations"
        ./$MIGRATE_DATABASE_SCRIPT
    fi
}

function create_database {
	if [ "${CREATE_DATABASE}" == "true" ]; then
		echo ">>>> Create database"
		./$CREATE_DATABASE_SCRIPT
	fi
}

function run_loc {
	sleep $SLEEP
	create_database
	migrate_database
	exec npm run $DEV_CMD
}

function run_test_environment {
	local readonly test_cmd="$1"
	sleep $SLEEP
	CREATE_DATABASE=true
	if [[ "$test_cmd" == "$PROD_CMD" ]]; then export NODE_ENV=production ; fi
	create_database
	migrate_database

	exec npm run $test_cmd
}

function run_demo {
	sleep $SLEEP

	create_database
	migrate_database
  
	exec npm run $PROD_CMD
}

function run_production {
	# by default run migrations if starting all servers at the same time
	if [[ $SERVERS == $ALL_SERVERS ]]; then migrate_database ; fi
	exec npm run $PROD_CMD
}

# Script execution starts here
while [[ $# > 0 ]]; do
	key="$1"

	case $key in
		-e|--environment)
			ENVIRONMENT="$2"
			shift
		;;
		-s|--sleep)
			SLEEP="$2"
			shift
		;;
		-k|--skip-database)
			SKIP_DATABASE_MIGRATIONS=true
		;;
		-c|--create-database)
			CREATE_DATABASE=true
		;;
		-a|--all)
			SERVERS=$ALL_SERVERS
		;;
		--service)
			SERVERS="$2"
			shift
		;;
		-m|--migrate)
			MIGRATE_DATABASE=true
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

# check environment is set
if [[ -z "${ENVIRONMENT}" ]] ; then
	echo "Environment not set"
	print_help_hint
	exit 3
fi

readonly PROD_CMD="start:${SERVERS}"
readonly DEV_CMD="dev:${SERVERS}"
readonly INTEGRATION_CMD="start-integration"

./configure.sh -p

. ./nvm-load.sh

if [[ "$MIGRATE_DATABASE" == "true" ]]; then
	migrate_database
	exit 0
fi

if [[ "${ENVIRONMENT}" == "loc" ]]; then
	run_loc
elif [[ "${ENVIRONMENT}" == "test" ]]; then
	run_test_environment $INTEGRATION_CMD
elif [[ "${ENVIRONMENT}" == "cucumber" ]]; then
	run_test_environment $PROD_CMD
elif [[ "${ENVIRONMENT}" == "prod" ]]; then
	run_production
elif [[ "${ENVIRONMENT}" == "demo" ]]; then
	run_demo
else
	echo "Invalid environment, supported environments are: loc, dev, test, cucumber, prod, demo"
fi
