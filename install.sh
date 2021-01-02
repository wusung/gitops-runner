#!/usr/bin/env bash
VAR=$1
APP_NAME=${VAR:=gitlab-deploy}
WORK_DIR=/opt/${APP_NAME}
SYSTEMD_SERVICE="/etc/systemd/system/${APP_NAME}.service"

if [ -d ${WORK_DIR} ]; then
    echo "${WORK_DIR} is existed. stop install."
    exit 1
fi

## Clone the repo
git clone https://github.com/wusung/gitlab-deploy.git ${WORK_DIR} || { echo >&2 "Clone failed with $?"; exit 1; }
pushd ${WORK_DIR}>/dev/null
npm install
popd >/dev/null

if [ ! -f ${SYSTEMD_SERVICE} ]; then
    cat >${SYSTEMD_SERVICE} <<EOF
[Unit]
Description=Gitlab deploy service
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

service ${APP_NAME} enable
