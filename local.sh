#!/bin/bash
set -e
SCRIPT_NAME="local.sh"
VERSION="0.1.2"
WORKSPACE="$(cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd)"
LOCAL_DOCKERFILE="Dockerfile.local"
LOCAL_IMAGE_NAME="red_web_local"
CONFIGURE_CMD="configure.sh"
CONFIGURE_SCRIPT=$WORKSPACE/$CONFIGURE_CMD
LOCAL_DEPLOYMENT_OPT="local"
RUN=""
SKIP_IMAGE_PULL=false
SKIP_CONFIGURE=false
SKIP_MIGRATIONS=false

DOCKER_DIRECTORY="docker"
MAIN_COMPOSE="$DOCKER_DIRECTORY/local-compose.yml"
MYDB_COMPOSE="$DOCKER_DIRECTORY/mydb-compose.yml"
COREDB_COMPOSE="$DOCKER_DIRECTORY/coredb-compose.yml"
BROWSER_COMPOSE="$DOCKER_DIRECTORY/browser-compose.yml"

POSTGRES_VOLUME=${HOME}/.red/db/data
DEFAULT_RED_WEB_COMMAND="-e loc"
CREATE_DATABASE_OPTION="-c"
SKIP_MIGRATIONS_OPTION="-k"
WAIT_OPTION="-s 10"
COREDB="coredb"
CUCUMBER_MODE=false

DOCKER_USER="testuser"
DOCKER_PASS="testpassword"
DOCKER_EMAIL="test@reva.tech"
DOCKER_REGISTRY="registry.corp.reva.tech"
DOCKER_CONFIG_PATH="${HOME}/.docker/config.json"

USER_PASSWORD=""
DEVTOOLS=true
SKIP_HOT_RELOAD=false
KNEX_DEBUG=true

SELENIUM_BROWSER=""
LOCAL_CHROME_BROWSER="CHROME_LOCAL"
CHROME_BROWSER="CHROME"
FIREFOX_BROWSER="FIREFOX"
CUCUMBER_SCRIPT_CMD="docker exec web ./scripts/cucumber-test.sh"
RENTAPP_CUCUMBER_SCRIPT_CMD="docker exec web ./scripts/cucumber-test.sh rentapp"
RESEXP_CUCUMBER_SCRIPT_CMD="docker exec web ./scripts/cucumber-test.sh resexp"
CUCUMBER_CMD="npm run cucumber-local"
RENTAPP_CUCUMBER_CMD="npm run rentapp:cucumber-local"
RESEXP_CUCUMBER_CMD="npm run resexp:cucumber-local"
CUCUMBER_HINT=">>>> To run the cucumber tests:"
RENTAPP_CUCUMBER_HINT=">>>> To run the rentapp cucumber tests:"
RESEXP_CUCUMBER_HINT=">>>> To run the resexp cucumber tests:"
LOCAL_SELENIUM_CMD="$CUCUMBER_HINT '$CUCUMBER_SCRIPT_CMD'\n$RENTAPP_CUCUMBER_HINT '$RENTAPP_CUCUMBER_SCRIPT_CMD'\n$RESEXP_CUCUMBER_HINT '$RESEXP_CUCUMBER_SCRIPT_CMD'\n"
LOCAL_CHROME_CMD="$CUCUMBER_HINT '$CUCUMBER_CMD'\n$RENTAPP_CUCUMBER_HINT '$RENTAPP_CUCUMBER_CMD'\n$RESEXP_CUCUMBER_HINT '$RESEXP_CUCUMBER_CMD'\n"
RUN_ALL_SERVERS=false
RUN_ALL_SERVERS_CMD="--all"


# On linux there is no need for VM so use localhost, otherwise use the IP of the default VM
if [ "$(uname -s)" == "Linux" ]; then
  BROWSER_HOSTNAME=localhost
  # Hack courtesy of
  # http://stackoverflow.com/questions/13322485/how-to-i-get-the-primary-ip-address-of-the-local-machine-on-linux-and-os-x
  LOCAL_IP_ADDRESS=$(ip -o route get to 8.8.8.8 | sed -n 's/.*src \([0-9.]\+\).*/\1/p'  )
else
  BROWSER_HOSTNAME=`docker-machine ip default`
  LOCAL_IP_ADDRESS=$DOMAIN
fi

# Ensure that the environment variable CLOUD_ENV is set
if [ -z $CLOUD_ENV ]; then
  echo "CLOUD_ENV needs to be specified. Should be set to the developer's name (as seen in reverseproxy repo)"
  exit 1;
fi

function print_version {
  echo "Red run local script $VERSION"
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
  echo "Usage: $SCRIPT_NAME run|stop [all] [OPTIONS]" ; echo
  echo "Red run local script. " ; echo
  echo "Options:" ; echo
  echo " --coredb               Use coredb instead of local postgres service"
  echo " -k|--skip-migrations   Skip running migrations"
  echo " -c|--cucumber          Prepares the local environment to carry out cucumber tests"
  echo " -b|--cucumber-browser  Set which browser to use to carry out cucumber tests [chrome_local|chrome|firefox]. Defaults to chrome_local"
  echo " --skip-configuration   Skip running application configuration script ($CONFIGURE_CMD)"
  echo " --skip-image-pull      Skip updating images, useful if images are already up to date"
  echo " -s|-skip-all           Skip application configuration and image pull. This is equivalent to --skip-configuration --skip-image-pull"
  echo " -h, --help             Print usage"
  echo " -v, --version          Print version information" ; echo
  echo "Usage:" ; echo
  echo "Run the application:"
  echo "$ ./$SCRIPT_NAME run" ; echo
  echo "Run the application including additional servers like the rentapp:"
  echo "$ ./$SCRIPT_NAME run all" ; echo
  echo "Stop the application:"
  echo "$ ./$SCRIPT_NAME stop" ; echo
  echo "Run the application using dev coredb instead of local database service:"
  echo "$ ./$SCRIPT_NAME run --coredb" ; echo
  echo "Run the application and skip configuration and image pulls:"
  echo "$ ./$SCRIPT_NAME run -s" ; echo
  echo "Run the application in cucumber mode with local installation of chrome:"
  echo "$ ./$SCRIPT_NAME run -c" ; echo
  echo "Run the application in cucumber mode with standalone chrome browser:"
  echo "$ ./$SCRIPT_NAME run -c -b chrome" ; echo
  exit 0
}

function check_docker_tools {
  local docker_tools_exist=true

  # check environment has necessary tools
  command -v docker >/dev/null 2>&1 || { echo >&2 ">>>> Docker is not installed"; docker_tools_exist=false; }
  command -v docker-compose >/dev/null 2>&1 || { echo >&2 ">>>> Docker compose is not installed"; docker_tools_exist=false; }

  if [[ "$docker_tools_exist" == "false" ]] ; then
    echo ">>>> Docker tools are not installed correctly, re run configure.sh"

    echo "Aborting" && exit 1
  fi
}

# login to redisrupt private docker registry
function login_registry {
  local login=false
  # if $DOCKER_CONFIG_PATH doesn't exist, we need to login
  if [[ ! -s $DOCKER_CONFIG_PATH ]] ; then
    login=true
  else
    # if docker config exists, check if the user has logged in to $DOCKER_REGISTRY before
    local has_logged_in=`cat $DOCKER_CONFIG_PATH | grep $DOCKER_REGISTRY`

    if [[ "$has_logged_in" == "" ]] ; then
      login=true
    fi
  fi

  if [[ "$login" == "true" ]] ; then
    echo ">>>> Login to registry: $DOCKER_REGISTRY"
    docker login -u $DOCKER_USER -p $DOCKER_PASS -e $DOCKER_EMAIL $DOCKER_REGISTRY
  fi
}

# get override compose file
function get_override_compose {
  if [[ "$LOCAL_DEPLOYMENT_OPT" == "local" ]] ; then
    echo "$MYDB_COMPOSE"
  else
    echo "$COREDB_COMPOSE"
  fi
}

# get compose file string ie. -f docker-compose-local.yml -f docker-compose-mydb.yml
function get_compose_file {
  local override_compose=$(get_override_compose)
  echo "-f $MAIN_COMPOSE -f $override_compose"
}

# list the containers that are currently running
function list_components {
  echo && docker ps --filter "network=local_default" --format "table {{.ID}}\t{{.Names}}\t{{.Ports}}"
}

# stops all containers and remove all containers
function decompose_host {
  local compose_file=$(get_compose_file)
  echo ">>>> Decomposing host $(get_override_compose)"

  set +e
  docker-compose $compose_file -p local down -v
  docker-compose -f $BROWSER_COMPOSE -p local down -v
  set -e

  list_components
}

# runs docker compose file
function compose_host {
  local compose_file=$(get_compose_file)
  echo ">>>> Composing host $(get_override_compose)"

  if [[ "$SKIP_IMAGE_PULL" == "false" ]] ; then
    login_registry
    # update images if required
    # ignore pull failure when pulling from $LOCAL_IMAGE_NAME
    docker-compose $compose_file pull --ignore-pull-failures
  else
    echo ">>>> Skipping image pull"
  fi

  # start or update the services
  docker-compose $compose_file -p local up -d && list_components
}

# run ./configure.sh script
function configure_application {
  if [[ "$SKIP_CONFIGURE" == "false" ]] ; then
    $CONFIGURE_SCRIPT
    check_docker_tools
  else
    echo ">>>> Skipping application configuration script ($CONFIGURE_CMD)"
  fi
}

# build local red image
function build_local_image {
  if [[ "$SKIP_IMAGE" == "false" ]] ; then
    echo ">>>> Building local image"
    docker build -t $LOCAL_IMAGE_NAME -f $LOCAL_DOCKERFILE .
  else
    echo ">>>> Skipping local image build"
  fi
}

# stops the local environment
function stop {
  decompose_host
}

# deploys local standalone browser if required
function process_cucumber_mode {
  if [[ "$CUCUMBER_MODE" == "true" ]] ; then
    local cmd_hint=$LOCAL_CHROME_CMD
    if [[ "$browser" != "$LOCAL_CHROME_BROWSER" ]] ; then
      cmd_hint=$LOCAL_SELENIUM_CMD
      compose_selenium_browser $browser
      echo -e "\n>>>> You can connect to the cucumber tests browser by connecting to it with a VNC client at: ${BROWSER_HOSTNAME}:5900 password: 'secret'\n"
    fi
    echo -e "$cmd_hint"
  fi
}

# runs a standalone selenium server with a browser configuration
# params $1 - name of the browser [google|chrome]
function compose_selenium_browser {
  local readonly browser=`echo "$1" | awk '{print tolower($0)}'`
  docker-compose -f $BROWSER_COMPOSE -p local up -d $browser
}

# runs the local environment
function run {
  echo ">>>> Running local environment, CMD: $RED_WEB_COMMAND"

  configure_application

  # start docker daemon if not previously running
  if [[ "$(is_docker_daemon_running)" != "0" ]] ; then
    prompt_user_password
    start_docker_daemon
  fi

  local browser=$LOCAL_CHROME_BROWSER
  if [[ "$CUCUMBER_BROWSER" == "$CHROME_BROWSER" || "$CUCUMBER_BROWSER" == "$FIREFOX_BROWSER" ]] ; then
    browser=$CUCUMBER_BROWSER
  fi
  export SELENIUM_BROWSER=$browser

  compose_host

  echo -e "\n>>>> Red is now running, you can view container logs with: docker logs -f CONTAINER_ID|CONTAINER_NAME\n"
  echo -e ">>>> Remember to use the -s flag when it's not necessary to update dependencies and pull images."
  echo -e ">>>> This flag prevents the script from running the configuration script and pulling the latest build images.\n"
  echo -e ">>>> Open your browser and enter the following url: http://${BROWSER_HOSTNAME}:3000\n"

  process_cucumber_mode
}

function prompt_user_password {
  if [[ -z "$USER_PASSWORD" ]] ; then
    read -sp "[sudo] password for ${USER}: " USER_PASSWORD && echo
  fi
}

function start_docker_daemon {
  echo ">>>> Starting docker daemon"

  mount_cgroup_fs

  touch $DOCKER_TOOLS_PATH/$DOCKER_DAEMON_LOG
  echo $USER_PASSWORD | sudo -S chgrp docker $DOCKER_TOOLS_PATH/$DOCKER_DAEMON_LOG
  echo $USER_PASSWORD | sudo -S docker daemon >> $DOCKER_TOOLS_PATH/$DOCKER_DAEMON_LOG 2>&1 &
}

# determines if the docker daemon is running
function is_docker_daemon_running {
  set +e
  docker info >/dev/null 2>&1
  local readonly exit_code=$?
  set -e
  echo $exit_code
}

# mounts control group filesystem
function mount_cgroup_fs {
  echo ">>>> Mounting control group filesystem"
  echo $USER_PASSWORD | sudo -S $DOCKER_TOOLS_PATH/$CGROUP_DIR/cgroupfs-mount
}

function handle_main_commands {
  local cmd="$1"
  if [[ "$cmd" == "run" ]] ; then
    RUN=true
  elif [[ "$cmd" == "stop" ]] ; then
    RUN=false
  fi
}

# script execution starts here
handle_main_commands "$1"

# go to next param if available
if [[ $# > 0 ]] && [[ "$RUN" != "" ]]; then
  shift
fi

# process options
while [[ $# > 0 ]]; do
  key="$1"

  case $key in
    --coredb)
      LOCAL_DEPLOYMENT_OPT=$COREDB
    ;;
    -k|--skip-migrations)
      SKIP_MIGRATIONS=true
    ;;
    -c|--cucumber)
      echo '>>> cucumber mode';
      DEVTOOLS=false
      SKIP_HOT_RELOAD=true
      KNEX_DEBUG=false
      CUCUMBER_MODE=true
    ;;
    -b|--cucumber-browser)
      CUCUMBER_BROWSER=`echo "$2" | awk '{print toupper($0)}'`
      shift
    ;;
    --skip-configuration)
      SKIP_CONFIGURE=true
    ;;
    --skip-image-pull)
      SKIP_IMAGE_PULL=true
    ;;
    -s|skip-all)
      SKIP_CONFIGURE=true
      SKIP_IMAGE_PULL=true
    ;;
    all)
      RUN_ALL_SERVERS=true
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

# i.e. -e loc -s 10
COMMAND=$DEFAULT_RED_WEB_COMMAND

# if the pg volume has not been created we need to add the create database option
if [[ ! -d $POSTGRES_VOLUME ]] && [[ "$LOCAL_DEPLOYMENT_OPT" != "$COREDB" ]]; then
  COMMAND="$COMMAND $WAIT_OPTION $CREATE_DATABASE_OPTION"
fi

# handle skipping migrations, do not migrate the database if using coredb
if [[ "$SKIP_MIGRATIONS" == "true" ]] || [[ "$LOCAL_DEPLOYMENT_OPT" == "$COREDB" ]] ; then
  COMMAND="$COMMAND $SKIP_MIGRATIONS_OPTION"
fi

if $RUN_ALL_SERVERS ; then
  COMMAND="$COMMAND $RUN_ALL_SERVERS_CMD"
fi

export RED_WEB_COMMAND=$COMMAND

export DEVTOOLS
export SKIP_HOT_RELOAD
export KNEX_DEBUG
export SELENIUM_BROWSER
export LOCAL_IP_ADDRESS

# default red log level to debug
export RED_LOG_LEVEL="${RED_LOG_LEVEL:=debug}"

if [[ "$RUN" == "true" ]] ; then
  run
elif [[ "$RUN" == "false" ]] ; then
  stop
else
  print_invalid_command
fi
