#!/bin/sh

set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)" && cd ..

# add npm bin directory to $PATH
PATH=$(npm bin):$PATH
export RED_PROCESS_NAME='map_mri_residents'

. ./nvm-load.sh

select option in "Run for a property" "Run for all properties" "Quit"; do
case "$option" in
    "Run for a property")
        echo "Please enter the property id:"
        read propertyId
        babel-node --extensions '.ts,.js,.json' server/import/mapMriResidents/mapMriResidents.js "$propertyId"
        break ;;
    "Run for all properties")
        echo "Run for all properties"
        babel-node --extensions '.ts,.js,.json' server/import/mapMriResidents/mapMriResidents.js
        break ;;
    "Quit") exit ;;
esac
done