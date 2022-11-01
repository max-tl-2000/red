#!/bin/sh
set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME=close_notification_channel
. ./nvm-load.sh

read -p "Are you sure you want to run this ? This script will close all the notification channels from $1 tenant y/n " yn
case $yn in
  [Yy]* ) babel-node server/workers/externalCalendars/closeNotificationChannel.js $1;;
  [Nn]* ) exit;;
  * ) echo "Please answer yes or no.";;
esac
