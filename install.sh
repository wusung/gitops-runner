#!/usr/bin/env bash

WORK_DIR=${HOME}/.gitlab-deploy-${RANDOM}
## Clone the repo
git clone https://github.com/wusung/gitlab-deploy.git ${WORK_DIR} || { echo >&2 "Clone failed with $?"; exit 1; }
pushd ${WORK_DIR}>/dev/null
npm install
popd >/dev/null

SYSTEMD_SERVICE="/etc/systemd/system/gitlab-deploy.service"

if [ ! -f ${SYSTEMD_SERVICE} ]; then
    cat >${SYSTEMD_SERVICE} <<EOF
${WORK_DIR}
EOF
    echo "${SYSTEMD_SERVICE} created."
fi
