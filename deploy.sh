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
	# make sure that raco's parsetab.py is up to date
	pushd submodules/raco ; ./scripts/myrial examples/uda.myl > /dev/null ; raco_exit_code=$? ; popd
	if [[ $raco_exit_code != 0 ]] ; then
		echo "could not re-create parsetab.py in raco submodule; cannot deploy"
		exit
	fi
	git rev-parse HEAD > appengine/VERSION && \
	git rev-parse --abbrev-ref HEAD > appengine/BRANCH && \
	appcfg.py --oauth2 update appengine
fi
