#!/bin/bash

cur_status="$(git status -s)"
cur_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ -n "$cur_status" ]
then
	echo "myria has been modified; cannot deploy"
elif [ "myria_auth" != "$cur_branch" ]
then
	echo "myria is not on the myria_auth branch; cannot deploy"
else
	git rev-parse HEAD > appengine/VERSION && \
	git rev-parse --abbrev-ref HEAD > appengine/BRANCH && \
	appcfg.py --oauth2 update appengine
fi
