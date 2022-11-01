#!/bin/bash

# Command line call: exportOffBoarded.sh customernew parties.csv

scriptName=$0

function print_help {
  echo "Usage: $scriptName {tenantName} {inputCsvFile}" ;
  echo "Example: $scriptName maximus inputFile.csv" ; echo
  echo "Based on csv [propertyName,type,partyId], pulls exports from the \"tenantName\" tenant and organizes output in the \"result\" directory" ; echo
  echo "Ensure to set the EXPORT_TOKEN environment variable before running the script by using the auth token from admin@reva.tech" ; echo
  echo "During processing, rows are removed from the input file and added to the {inputFile}-result.{csv} file. This allow to easily track the progress and resume after failure by just executing the same command again." ;
  exit 0
}

if [[ $# != 2 ]]; then
  print_help
fi

tenant=$1
file=$2
fileName="${2%.*}"
fileExt="${2##*.}"
echo "Processing \"$fileName.$fileExt\""

exportToken=$EXPORT_TOKEN

# Retrieve the folder to use to get the list of files to process

# Input:
#   - env variable: EXPORT_TOKEN: create a token fo the tenant to access route: api/export
#   - a csv file name that contains the list of parties to export (subdirectories will be created when needed)

# Note: process can be interrupted at any time, or in case of failure, the filename of the csv suffixed with _result will indicate the parties that have been already exported, and the input file will only contain what is left.
# Note that the csv header is removed

# The csv format is: propertyName, type (inflight/resident), partyId

# Remove the headers if present
sed -i'' -e '/property/d' "$file"

# Read the first line of the csv file
line=`head -n 1 "$file"`;

start=`date +%s`;
originalWD=`pwd`

# If there is no data, then it means that we are done!
while [ -n "$line" ];
do
  line=`echo $line|tr -d '\r'`
  echo "$line";

  # Extract folder structure
  IFS=',' read -ra lineData <<< "$line"
  property=${lineData[0]}
  partyType=${lineData[1]}
  partyId=${lineData[2]}
  mkdir -p "result/$property/$partyType";
  cd "$originalWD/result/$property/$partyType"

  # Export the party
  echo "Retrieving $property/$partyType/$partyId"
  httpCode=$(curl -w '%{http_code}\n' -J -O "https://$tenant.reva.tech/api/parties/$partyId/export?token=$exportToken" --silent)

  cd "$originalWD"

  # In case of success,
  if (( $httpCode == 200 ));
  then
    # Remove the first line from the file
    sed -i'' -e '1d' "$file"

    # And append the data to the result file
    echo $line >> "$fileName-results.$fileExt"

    echo "Successful"

  # In case of failure, just stop the process and return error
  else
    echo "Failed: $httpCode"
    echo "curl -w '%{http_code}\n' -J -O 'https://$tenant.reva.tech/api/parties/$partyId/export?token=$exportToken'"
    end=`date +%s`
    echo "Execution time: $((end-start))s"
    exit 1
  fi

  # Next line
  line=`head -n 1 "$file"`;
done

end=`date +%s`
echo "Execution time: $((end-start))s"
