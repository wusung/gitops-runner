# Deploy Runner

## Purpose
The project aims to deploy the application of distribution to target server behind the firewall.

## How to install

```
curl https://raw.githubusercontent.com/wusung/deploy-runner/master/install.sh | bash -s -- -r=/var/www -a=deploy-runner -p=3030
```

## Check the service with systemd

```shell
service deploy-runner status
```

## How to uninstall

```shell
rm /etc/systemd/system/deploy-runner.service
rm -rf /var/lib/deploy-runner
rm -rf /opt/deploy-runner
```
