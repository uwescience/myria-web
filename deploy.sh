#!/bin/bash

cur_status="$(git status -s)"
cur_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ -n "$cur_status" ]
then
	echo "myria-web has been modified; cannot deploy"
elif [ "production" != "$cur_branch" ]
then
	echo "myria-web is not on the production branch; cannot deploy"
else
	git rev-parse HEAD > appengine/VERSION && \
	appcfg.py --oauth2 update appengine
fi
