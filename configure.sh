#!/bin/bash
# enable bash fail-fast
set -e

. ./_common.sh

SCRIPT_NAME="configure.sh"
VERSION="0.5.0"

#####  Required versions #####
REQUIRED_DOCKER_VERSION="20.10.16"
REQUIRED_DOCKER_COMPOSE_VERSION="1.23.2"
##############################

WAS_NODE_OR_YARN_OR_NPM_UPDATED=0
PRODUCTION_FLAG=""
PROFILE=".bashrc"
NODE_MODULES_DIR="node_modules"

REQUIRED_ARCH="x86_64"
DOCKER_BIN_DIR=".docker-tools"
DOCKER_BIN_PATH=${HOME}/$DOCKER_BIN_DIR
DOCKER_COMPOSE_BIN_URL="https://github.com/docker/compose/releases/download"
CGROUP_HELPER_URL="https://github.com/tianon/cgroupfs-mount.git"
CGROUP_DIR="cgroupfs-mount"
DOCKER_DAEMON_LOG="daemon.log"
USER_PASSWORD=${USER_PWD}

DOCKER_TOOLS_DIR=".docker-tools"
DOCKER_TOOLS_PATH=${HOME}/$DOCKER_TOOLS_DIR
USER_BIN_PATH="/usr/bin"
USER_LOCAL_BIN_PATH="/usr/local/bin"
TEMP_DIR="/tmp"

if [ -f "${HOME}/${PROFILE}" ]; then
  source "${HOME}/${PROFILE}"
fi

function getOS {
  local OS=''

  case "$(uname -s)" in
   Darwin)
     OS='Mac'
   ;;

   Linux)
     OS='Linux'
   ;;

   CYGWIN*|MINGW32*|MSYS*)
     OS='MSWin'
   ;;

   # Add here more strings to compare
   # See correspondence table at the bottom of this answer

   *)
     OS='Other'
   ;;
  esac

  echo "${OS}";
}

function install_deps {
  log 'Installing deps'
  # TODO: install prod dependencies only when these issues are fixed
  # https://github.com/yarnpkg/yarn/issues/1462
  # https://github.com/yarnpkg/yarn/issues/761
  yarn install --prefer-offline --force
  warn '[Warn] Chromedriver is not longer installed as a dev dependency.'
  warn '[Warn] If needed you can install it running:'
  warn ''
  warn 'npm i chromedriver@latest'
  warn ''
  log 'Done installing'
}

function remove_babel_cache_if_needed {
  local BABEL_CACHE_FILE="${HOME}/.babel.json";

  log "Check if '${BABEL_CACHE_FILE}' should be removed";

  if [[ $(find ${BABEL_CACHE_FILE} -type f -size +102400c 2>/dev/null) ]]; then
    rm -rf "${BABEL_CACHE_FILE}";
    log "Babel cache file '${BABEL_CACHE_FILE}' removed.";
  else
    if [[ $(ls -l "${BABEL_CACHE_FILE}" 2>/dev/null) ]]; then
      log "Babel cache file is not bigger than 100MB";
      echo '';
      ls -l "${BABEL_CACHE_FILE}";
      echo '';
    else
      log "Babel cache file does not exist";
    fi
  fi
}

function ensure_versions {
  log 'Check versions'

  local VERSIONS_MISMATCH=false;

  # Check whether nvm exists in this env
  local NVM_VERSION=$(nvm --version);
  if [ "${NVM_VERSION}" != "${REQUIRED_NVM_VERSION}" ]; then
    VERSIONS_MISMATCH=true;
    warn "NVM version mismatch, ${NVM_VERSION} found. Required is ${REQUIRED_NVM_VERSION}";

    # If Mac or Linux, just automatically install
    if [ "${CURRENT_OS}" != "MSWin" ]; then

      # For mac, mac terminal uses the .profile file, while the bash script is using bashrc
      # So ensure that nvm install updates bashrc, and that we add bashrc to the .profile file
      touch "${HOME}/${PROFILE}";
      if [ "${CURRENT_OS}" == "Mac" ]; then
        touch "${HOME}/.profile";
        if [ "$(grep '.bashrc' ${HOME}/.profile)" == "" ]; then
          echo "source ~/.bashrc" >> "${HOME}/.profile";
        fi
      fi

      # The sed command is replacing the appending by a prepending in the profile file of the nvm tools (bashrc on linux system).
      # On linux some default bashrc ignore its content when sourced from a script
      if [ "$(which curl)" != "" ]; then
        curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/v${REQUIRED_NVM_VERSION}/install.sh" | sed -e 's/>> \"\$NVM_PROFILE\"/\| cat - "$NVM_PROFILE" > .nvm_tmp \&\& mv .nvm_tmp "$NVM_PROFILE"/g' | bash;
      elif [ "$(which wget)" != "" ]; then
        wget -qO- "https://raw.githubusercontent.com/nvm-sh/nvm/v${REQUIRED_NVM_VERSION}/install.sh" | sed -e 's/>> \"\$NVM_PROFILE\"/\| cat - "$NVM_PROFILE" > .nvm_tmp \&\& mv .nvm_tmp "$NVM_PROFILE"/g' | bash;
      else
        log "No curl or wget detected!"
        exit 1;
      fi

      source "${HOME}/${PROFILE}"
      NVM_VERSION=$(nvm --version);
    fi
  else
    log "nvm    ==> required version found: ${NVM_VERSION}"
  fi

  local NODE_VERSION=$(node -v);
  if [ "${NODE_VERSION}" != "${REQUIRED_NODE_VERSION}" ]; then
    VERSIONS_MISMATCH=true;
    warn "Node version mismatch, ${NODE_VERSION} found. Required is ${REQUIRED_NODE_VERSION}";

    # Needed because something in the nvm exec is creating an error and the scripts exits
    set +e
    nvm install $REQUIRED_NODE_VERSION
    nvm use $REQUIRED_NODE_VERSION
    set -e

    log "Installed required version: $(node -v)";
    WAS_NODE_OR_YARN_OR_NPM_UPDATED=1
  else
    log "node   ==> required version found: ${NODE_VERSION}"
  fi

  local NPM_VERSION=$(npm -v);

  if [ "${NPM_VERSION}" != "${REQUIRED_NPM_VERSION}" ]; then
    VERSIONS_MISMATCH=true;
    warn "npm version mismatch, ${NPM_VERSION} found. Required is ${REQUIRED_NPM_VERSION}";

    echo ""
    log "npm i -sg npm@${REQUIRED_NPM_VERSION}"
    echo ""

    npm i -sg npm@${REQUIRED_NPM_VERSION}
    echo "Updating yarn since npm was updated"
    npm i -sg yarn@${REQUIRED_YARN_VERSION}

    WAS_NODE_OR_YARN_OR_NPM_UPDATED=1
  else
    log "npm    ==> required version found: ${REQUIRED_NPM_VERSION}"
  fi

  if [[ -z "$PRODUCTION_FLAG" ]]; then
    # only in cases where this script is called in dev mode
    # we want to remove the .babel.json cache file to prevent
    # the memory leak issues described here https://github.com/mochajs/mocha/issues/2770
    remove_babel_cache_if_needed;

    local YARN_VERSION=$(yarn --version);

    if [ "${YARN_VERSION}" != "${REQUIRED_YARN_VERSION}" ]; then
      VERSIONS_MISMATCH=true;
      warn "yarn version mismatch, ${YARN_VERSION} found. Required is ${REQUIRED_YARN_VERSION}";
      log "Installing required version: ${REQUIRED_YARN_VERSION}";
      echo ""
      log "npm i -sg yarn@${REQUIRED_YARN_VERSION}"
      echo ""

      npm i -sg yarn@${REQUIRED_YARN_VERSION}
      yarn --version
    else
      log "yarn   ==> required version found: ${REQUIRED_YARN_VERSION}"
    fi
  fi

  local RESULT=$1; # $1 => FORCE_INSTALL

  # if already true we don't need to assign it again
  if [ "${RESULT}" == "false" ]; then
    eval "$RESULT='$VERSIONS_MISMATCH'";
  fi

  # install docker tools if environment is a linux machine and not a production build
  if [[ "$CURRENT_OS" == "Linux" ]] && [[ -z "$PRODUCTION_FLAG" ]] ; then
    ensure_docker_version
  fi
}

function remove_user_docker_paths {
  sed -i '/export DOCKER_BIN_PATH/d' ${HOME}/${PROFILE}
  sed -i '/'"$DOCKER_BIN_DIR"'/d' ${HOME}/${PROFILE}
  source "${HOME}/${PROFILE}"
}

function uninstall_previous_installation {
  if [[ -d "$DOCKER_BIN_PATH" ]]; then
    remove_user_docker_paths
  fi

  if [[ -f "${DOCKER_BIN_PATH}/docker" ]]; then
    uninstall_docker_engine "${DOCKER_BIN_PATH}/docker*"
  fi

  if [[ -f "${DOCKER_BIN_PATH}/docker-compose" ]]; then
    uninstall_docker_compose "${DOCKER_BIN_PATH}/docker-compose"
  fi
}

function is_cgroup_in_user_profile {
  cat "${HOME}/${PROFILE}" | grep "export CGROUP_DIR"
}

function is_daemon_log_in_user_profile {
  cat "${HOME}/${PROFILE}" | grep "export DOCKER_DAEMON_LOG"
}

function is_docker_tools_path_in_user_profile {
  cat "${HOME}/${PROFILE}" | grep "export DOCKER_TOOLS_PATH"
}

# installs or updates the docker tools
function ensure_docker_version {
  check_docker_prerequisites
  uninstall_previous_installation

  if [[ -z "$(is_cgroup_in_user_profile)" ]] ; then
    sed -i '1s|^|export CGROUP_DIR='"$CGROUP_DIR"'\n|' ${HOME}/${PROFILE}
    source "${HOME}/${PROFILE}"
  fi

  if [[ -z "$(is_daemon_log_in_user_profile)" ]] ; then
    sed -i '1s|^|export DOCKER_DAEMON_LOG='"$DOCKER_DAEMON_LOG"'\n|' ${HOME}/${PROFILE}
    source "${HOME}/${PROFILE}"
  fi

  if [[ -z "$(is_docker_tools_path_in_user_profile)" ]] ; then
    sed -i '1s|^|export DOCKER_TOOLS_PATH='"$DOCKER_TOOLS_PATH"'\n|' ${HOME}/${PROFILE}
    source "${HOME}/${PROFILE}"
  fi

  local docker_exists=true
  local docker_compose_exists=true

  local docker_version=$REQUIRED_DOCKER_VERSION
  local docker_compose_version=$REQUIRED_DOCKER_COMPOSE_VERSION

  local external_docker_tools=false

  command -v dockerd >/dev/null 2>&1 || { echo >&2 ">>>> Docker is not installed"; docker_exists=false; }
  command -v docker-compose >/dev/null 2>&1 || { echo >&2 ">>>> Docker compose is not installed"; docker_compose_exists=false; }

  # process docker engine
  if [[ "$docker_exists" == "true" ]] ; then
    docker_version=$(get_docker_version)

    if [[ "$docker_version" != "$REQUIRED_DOCKER_VERSION" ]] ; then
      log "Docker $REQUIRED_DOCKER_VERSION is required, but found $docker_version instead"
      prompt_user_password
      uninstall_docker_engine "${USER_BIN_PATH}/docker*"
      install_docker_engine
    else
      log "Docker $docker_version is already installed"
    fi
  else
    prompt_user_password
    install_docker_engine
  fi

  # process docker compose
  if [[ "$docker_compose_exists" == "true" ]] ; then
    docker_compose_version=$(get_docker_compose_version)

    if [[ "$docker_compose_version" != "$REQUIRED_DOCKER_COMPOSE_VERSION" ]] ; then
      log "Docker compose $REQUIRED_DOCKER_COMPOSE_VERSION is required, but found $docker_compose_version instead"
      prompt_user_password
      uninstall_docker_compose "${USER_LOCAL_BIN_PATH}/docker-compose"
      install_docker_compose
    else
      log "Docker compose $docker_compose_version is already installed"
    fi
  else
      prompt_user_password
      install_docker_compose
  fi

  # start docker daemon if not previously running
  if [[ "$(is_docker_daemon_running)" != "0" ]] ; then
    prompt_user_password
    start_docker_daemon
    log "Giving docker a second to start..."
    sleep 1.5
    # make sure it started...
    log "Checking that docker started..."
    if [[ "$(is_docker_daemon_running)" != "0" ]] ; then
      log "Docker daemon did not start!  Here is the log..."
      cat $DOCKER_TOOLS_PATH/$DOCKER_DAEMON_LOG
      df -kh
      ps -aef
      exit 1
    fi
  else
    log "Docker is already running - do not need to start"
  fi
}

function check_docker_prerequisites {
  local readonly arch=$(uname -m)

  if [[ "$arch" != "$REQUIRED_ARCH" ]] ; then
    log "Docker requires a 64 bit OS"
    exit 4
  fi
}

function get_docker_version {
  dockerd --version | grep -o '\([0-9]\{1,\}\.\)\+[0-9]\{1,\}\(\-rc[0-9]\)*\(\-ce\)*'
}

function get_docker_compose_version {
  docker-compose --version | grep -o '\([0-9]\{1,\}\.\)\+[0-9]\{1,\}'
}

function get_docker_bin_url {
  local sub_domain="download"
  case "$REQUIRED_DOCKER_VERSION" in
  *rc*)
    sub_domain="test"
  ;;
  esac
  echo "https://${sub_domain}.docker.com"
}

function install_docker_engine {
  local readonly docker_url="${DOCKER_BIN_URL}/docker-${REQUIRED_DOCKER_VERSION}.tgz"
  log "Installing docker $REQUIRED_DOCKER_VERSION from $docker_url"

  curl -L $docker_url > $TEMP_DIR/docker && tar -zxf $TEMP_DIR/docker -C $TEMP_DIR
  echo $USER_PASSWORD | sudo -S mv $TEMP_DIR/docker/docker* $USER_BIN_PATH
  rm -rf $TEMP_DIR/docker

  if [[ -z "$(docker_group)" ]] ; then
    log "Creating docker group"
    echo $USER_PASSWORD | sudo -S groupadd docker
  else
    log "Docker group already exists"
  fi

  if [[ -z "$(docker_user)" ]] ; then
    log "Adding ${USER} to docker group"
    echo $USER_PASSWORD | sudo -S usermod -aG docker ${USER}
  else
    log "${USER} already belongs to docker group"
  fi
}

function prompt_user_password {
  if [[ -z "$USER_PASSWORD" ]] && [[ -z "$CONTINUOUS_INTEGRATION" ]] ; then
    read -sp "[sudo] password for ${USER}: " USER_PASSWORD && echo
  fi
}

function install_docker_compose {
  log "Installing docker compose $REQUIRED_DOCKER_COMPOSE_VERSION"
  curl -L $DOCKER_COMPOSE_BIN_URL/$REQUIRED_DOCKER_COMPOSE_VERSION/docker-compose-`uname -s`-`uname -m` > $TEMP_DIR/docker-compose
  echo $USER_PASSWORD | sudo -S mv $TEMP_DIR/docker-compose $USER_LOCAL_BIN_PATH/docker-compose
  echo $USER_PASSWORD | sudo -S chmod +x $USER_LOCAL_BIN_PATH/docker-compose
}

# uninstall docker binary
# param $1 - docker binary path
function uninstall_docker_engine {
  local readonly docker_path="$1"
  log "Uninstalling docker at $docker_path"
  stop_docker_daemon
  echo $USER_PASSWORD | sudo -S rm $docker_path
}

# uninstall docker compose binary
# param $1 - docker compose binary path
function uninstall_docker_compose {
  local readonly docker_compose_path="$1"
  log "Uninstalling docker compose at $docker_compose_path"
  echo $USER_PASSWORD | sudo -S rm $docker_compose_path
}

function docker_group {
  cut -d: -f1 /etc/group | grep -o docker
}

function docker_user {
  groups ${USER} | grep -o docker
}

function start_docker_daemon {
  log "Starting docker daemon"

  # MAM Temporary
  set -x
  ls -lrt /usr/bin/containerd || true
  ls -lrt /usr/bin/dockerd || true
  echo $PATH
  DOCKER_DAEMON_OPTS="--log-level debug"
  echo $USER_PASSWORD | sudo -S apt install containerd
  which containerd
  which dockerd
  set +x
  # MAM

  if [[ ! -d $DOCKER_TOOLS_PATH/$CGROUP_DIR ]] ; then
    clone_cgroup_helper
  fi

  mount_cgroup_fs

  touch $DOCKER_TOOLS_PATH/$DOCKER_DAEMON_LOG
  echo $USER_PASSWORD | sudo -S chgrp docker $DOCKER_TOOLS_PATH/$DOCKER_DAEMON_LOG
  echo $USER_PASSWORD | sudo -S dockerd $DOCKER_DAEMON_OPTS >> $DOCKER_TOOLS_PATH/$DOCKER_DAEMON_LOG 2>&1 &
}

function stop_docker_daemon {
  log "Stopping docker daemon"
  set +e
  echo $USER_PASSWORD | sudo killall -r docker*
  set -e
}

# determines if the docker daemon is running
function is_docker_daemon_running {
  set +e
  docker info >/tmp/docker-info.log 2>&1
  local readonly exit_code=$?
  set -e
  echo $exit_code
}

# clones control group filesystem helper
function clone_cgroup_helper {
  log "Installing control group filesystem helper"
  git clone $CGROUP_HELPER_URL $DOCKER_TOOLS_PATH/$CGROUP_DIR
}

# mounts control group filesystem
function mount_cgroup_fs {
  log "Mounting control group filesystem"
  echo $USER_PASSWORD | sudo -S $DOCKER_TOOLS_PATH/$CGROUP_DIR/cgroupfs-mount
}

function print_version {
  echo "Red configure script $VERSION"
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
  echo "Red configure script." ; echo
  echo "Options:" ; echo
  echo " -f, --force         Force the install of dependencies even if package.json 'dependencies'"
  echo "                     or 'devDependencies' fields didn't change since previous execution."
  echo " -i, --ci            Set the CONTINUOUS_INTEGRATION env variable as 'true'"
  echo " -p, --production    Install the production dependencies"
  echo " -h, --help          Print usage"
  echo " -v, --version       Print version information" ; echo
  exit 0
}

CURRENT_OS=$(getOS);

# Script execution starts here
while [[ $# > 0 ]]; do
  key="$1"

  case $key in
      -i|--ci)
        log "Building as in CI"
        export CONTINUOUS_INTEGRATION=true
      ;;
      -p|--production)
        log "Production dependencies"
        PRODUCTION_FLAG=--production
      ;;
      -f|--force)
        log "Force install deps"
        FORCE_INSTALL=true
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

DOCKER_BIN_BASE_URL=$(get_docker_bin_url)
#DOCKER_BIN_URL="${DOCKER_BIN_BASE_URL}/builds/Linux/x86_64"
DOCKER_BIN_URL="${DOCKER_BIN_BASE_URL}/linux/static/stable/x86_64"

logBlock "configure.sh start"

ensure_versions FORCE_INSTALL;

if [[ -z "$PRODUCTION_FLAG" ]]; then
  # only install deps if no production flag is provided
  install_deps ${FORCE_INSTALL}
  # check the node_modules file count
  ./bnr modules-count-check
  # clean the old cache only in no production envs
  ./bnr clean-old-cache
# else
  # inside the container we need to rebuild the native modules
  # npm rebuild
fi

# nvm is tricky as it is dependent on the current shell, so it is better restart a new shell after a version update
if [ $WAS_NODE_OR_YARN_OR_NPM_UPDATED == 1 ]; then
  log "execute 'source ./nvm-load.sh' to load the configured env in your current session"
fi

logBlock "configure.sh done"
