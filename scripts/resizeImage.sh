#!/bin/bash

# This utility works on mac to resize the images if they are larger or higher than the specified number of pixels
# To get it working on Linux, we could use imagemagick

# Example of execution used to resize teh images for teh sample images:
#    find . -name "*.jpg"|sed "s/ /\\\ /g"|xargs ../scripts/resizeImage.sh 650

requestedSize=$1

for theFile in "${@:2}"
do
  size=($(sips -g pixelWidth -g pixelHeight "$theFile" | grep -o '[0-9]*$'))

  if [[ ${size[0]} -gt $requestedSize || ${size[1]} -gt requestedSize ]]; then
    echo Resizing $theFile: ${size[0]}x${size[1]}
    sips -Z $requestedSize "$theFile"
  fi
done