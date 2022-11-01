#!/bin/sh

# The remote repo is origin for this script

# Env variables:
#   DRY_RUN=1: Only dry run
#   DELETE_LOCAL=1: Only delete local branches

# Example of date "2017-01-01"
date=$1

requestedTimestamp=`date -j -f "%Y-%m-%d" $date "+%s"`
currentTimestamp=`date -j "+%s"`
secondsDiff=$(( $currentTimestamp - $requestedTimestamp ))
if [[ $secondsDiff -lt 3600*24*90 ]]; then
  echo "You have to select a date that is more than 3 months in the past" 
  exit
fi

for branch in $(git branch -a | sed 's/^\s*//' | sed 's/^remotes\///' | grep -v 'master' | grep -v 'feature' | grep -v 'demo_' | grep -v 'prod_' | grep -v '\/\d\d\.' | grep -v '\/v\d\.' | grep -v 'dont-delete'); do
  if [[ "$(git log $branch --since $date | wc -l)" -eq 0 ]]; then
    if [[ "$DELETE_LOCAL" -eq 1 ]]; then
      if [[ "$DRY_RUN" -eq 1 ]]; then
        echo "git branch -D $branch"
      else
        git branch -D $branch
      fi
    elif [[ "$branch" =~ "origin/" ]]; then
      local_branch_name=$(echo "$branch" | sed 's/^remotes\/origin\///')
      if [[ "$DRY_RUN" -eq 1 ]]; then
        echo "git push origin :$local_branch_name"
      else
        git push origin :$local_branch_name
      fi
    fi
  fi
done
