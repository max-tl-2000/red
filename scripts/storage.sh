#!/bin/bash
# pass the -tmpfs flag to speed up integration tests
# you will need to stop and remove the running containers
# before running the backend services in normal mode again
set -e
ARGS=($@)
DOCKER_DIRECTORY=docker
BASE_COMPOSE_FILE=docker-compose-local.yml
PERSISTENCE_COMPOSE_FILE=docker-compose-local-persistence.yml
TMPFS_COMPOSE_FILE=docker-compose-local-tmpfs.yml
RXP_COMPOSE_FILE=docker-compose-local-rxp.yml
COMPOSE_FILES="-f $BASE_COMPOSE_FILE"
MOUNT_TMPFS="-tmpfs"
RXP="-rxp"

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ../$DOCKER_DIRECTORY

ARG_INDEX=0 ; TMPFS_ARG_INDEX=0 ; USE_TMPFS=false ; RXP_ARG_INDEX=0; USE_RXP=false
for argument in ${ARGS[@]}; do
	if [[ $argument == $MOUNT_TMPFS ]]; then 
		TMPFS_ARG_INDEX=$ARG_INDEX ; USE_TMPFS=true
	elif [[ $argument == $RXP ]]; then 
		RXP_ARG_INDEX=$ARG_INDEX ; USE_RXP=true
	fi
	ARG_INDEX=$((ARG_INDEX + 1))
done

if [[ "$USE_TMPFS" == "true" ]]; then
	ARGS_TMP=(${ARGS[$TMPFS_ARG_INDEX]})
	ARGS=("${ARGS[@]/$ARGS_TMP}")
	COMPOSE_FILES="$COMPOSE_FILES -f $TMPFS_COMPOSE_FILE"
else
	COMPOSE_FILES="$COMPOSE_FILES -f $PERSISTENCE_COMPOSE_FILE"
fi

if [[ "$USE_RXP" == "true" ]]; then
	ARGS_TMP=(${ARGS[$RXP_ARG_INDEX]})
	ARGS=("${ARGS[@]/$ARGS_TMP}")
	COMPOSE_FILES="$COMPOSE_FILES -f $RXP_COMPOSE_FILE"
fi

PROXIED_HOSTNAME=localhost
# use dev-proxy in docker bridged mode if using macOS
if [ "$(uname)" == "Darwin" ]; then
	WEB_PROXY_NETWORK_MODE=bridge
	PROXIED_HOSTNAME="docker.for.mac.localhost"
fi

export WEB_PROXY_NETWORK_MODE; export PROXIED_HOSTNAME
docker-compose -p local $COMPOSE_FILES ${ARGS[@]}
