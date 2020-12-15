#!/usr/bin/env bash

WORK_DIR=${HOME}/.gitlab-deploy-${RANDOM}
SYSTEMD_SERVICE="/etc/systemd/system/gitlab-deploy.service"

## Clone the repo
git clone https://github.com/wusung/gitlab-deploy.git ${WORK_DIR} || { echo >&2 "Clone failed with $?"; exit 1; }
pushd ${WORK_DIR}>/dev/null
npm install
popd >/dev/null

if [ ! -f ${SYSTEMD_SERVICE} ]; then
    cat >${SYSTEMD_SERVICE} <<EOF
[Unit]
Description=Gitlab Ddeploy service
After=network.target

[Service]
Type=idle
User=root
Group=root
WorkingDirectory=${WORK_DIR}
ExecStart=/usr/bin/env node ${WORK_DIR}/server.js
TimeoutStartSec=600
TimeoutStopSec=600
StandardOutput=null
StandardError=null

[Install]
WantedBy=multi-user.target
EOF
    echo "${SYSTEMD_SERVICE} created."
fi
