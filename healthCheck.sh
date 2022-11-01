#!/bin/bash
# This script reads a list of health endpoints and executes, docker HEALTHCHECK
# command expects exit code 0 for success and 1 for error
# Usage:
#  ./healthCheck.sh # check default servers defined in healthEndpoints.json
#  ./healthCheck.sh localhost:3070/ping,localhost:3080/ping,localhost:4000/ping # check custom list of servers

# throw error on failure (-f), wait up to 5 secs to connect and 5 secs for results
readonly CURL_CMD="curl -f --max-time 5 --connect-timeout 5"
readonly BASE_URL="http://health.${DOMAIN:-local.env.reva.tech}:3030"
readonly HEALTH_ENDPOINTS_FILE_NAME="healthEndpoints.json"
if [[ ! -f "$HEALTH_ENDPOINTS_FILE_NAME" ]] ; then exit 1 ; fi

# stores comma delimited list of endpoints
HEALTH_ENDPOINTS_LIST=`jq -r '.healthEndpoints | join(",")' $HEALTH_ENDPOINTS_FILE_NAME`

if [[ $# -gt 0 ]]; then
  HEALTH_ENDPOINTS_LIST=$@
fi

IFS="," read -ra HEALTH_ENDPOINTS_ARRAY <<< "$HEALTH_ENDPOINTS_LIST" # turns comma delimited list into array

for i in ${HEALTH_ENDPOINTS_ARRAY[@]}; do
  ENDPOINT=`echo "$i" | sed -e "s#BASE_URL#$BASE_URL#g"` # using "#" as delimiter because urls contain "/"
  $CURL_CMD $ENDPOINT || exit 1 # we need to throw 1 if there is an error
done
