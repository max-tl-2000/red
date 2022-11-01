#!/bin/sh

# Expects that the file parties.txt exists with the list of parties to export for customerold/maximus and the token

tenant=$1
token=$2

`cat parties.txt|awk '{printf "curl -J -O '\''https://'$tenant'.reva.tech/api/parties/%s/export?token='$token''\'' -H '\''User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:80.0) Gecko/20100101 Firefox/80.0'\'' -H '\''Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'\'' -H '\''Accept-Language: en-US,en;q=0.5'\'' --compressed -H '\''Connection: keep-alive'\'' -H '\''Referer: https://'$tenant'.reva.tech/party/%s'\'' -H '\''Cookie: zendesk_reva_user=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImFkbWluQHJldmEudGVjaCIsIm5hbWUiOiJSZXZhIEFkbWluIiwib3JnYW5pemF0aW9uIjoiaXJldCIsImlhdCI6MTYwMjUyODQ3MH0.9KwrQHiboiX5_hqDnt38oAY69rIkCqJVNArTVFmLnvg; sisense_reva_user=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImFkbWluQHJldmEudGVjaCIsImlhdCI6MTYwMjUyODQ3MH0.fs2OLtAueUkq1wGDveQY4Cb-EyIU1cB3_sILxpgWZuk'\'' -H '\''Upgrade-Insecure-Requests: 1'\'' -H '\''TE: Trailers'\''\n", $1, $1}' > parties_exec.txt`

