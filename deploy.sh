#!/bin/bash

if [ -z "$(git status -s)" ]
then
	git rev-parse HEAD > appengine/VERSION && \
	appcfg.py --oauth2 update appengine
else
	echo "myria-web has been modified; cannot deploy"
fi
