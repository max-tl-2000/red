#!/bin/bash

# Command line call: exportOffBoarded.sh customernew parties.csv

set -e

scriptName=$0

function print_help {
  echo "Usage: $scriptName {gDriveFolderPath}" ;
  echo "Usage: $scriptName exportOffboarded" ; echo
  echo "After calling exportOffBoarded to export parties under the \"result\" directory, this script zips per properties, and then upload them in the gdrive folder" ; echo
  echo "Ensure that creds for google drive are present in the ~/. file. To authenticate again, try \"gdrive list\" which will provid the url to allow access" ; echo
  exit 0
}

if [[ $# != 1 ]]; then
  print_help
fi

gDriveFolderPath=$1

# Ensure that token is set-up and show current user
gdrive about
gDriveFolderId=`gdrive mkdir "$gDriveFolderPath" | awk '{print $2};'`

start=`date +%s`;
originalWD=`pwd`
resultDir="$originalWD/result"
tmpDir="tmp"
cd "$resultDir"

# For each property folder
for property in *;
do
  # Ignore files and tmp dir
    if [[ -f "$property" || "$property" == 'tmp' ]]; then
        continue;
    fi

  mkdir -p $tmpDir;

  echo "Processing $property"
  zipFile="$tmpDir/$property.zip"

  # Compress the property folder
  zip -r -q "$zipFile" "$property"

  # Upload the compressed file
  gdrive upload -p "$gDriveFolderId" "$zipFile"

  # Delete zip file
  rm "$zipFile"

done

cd "$originalWD"

end=`date +%s`
echo "Execution time: $((end-start))s"; echo
echo "Do not forget to remove the ~/.gdrive directory that contains the access token we are done with the offboarding"