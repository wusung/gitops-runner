#!/usr/bin/env bash

TMP_DIR=$HOME/.gitlab-deploy-$RANDOM
## Clone the repo
git clone https://gitlab.com/wusung/gitlab-deploy $TMP_DIR || { echo >&2 "Clone failed with $?"; exit 1; }
pushd $TMP_DIR
yarn

popd
