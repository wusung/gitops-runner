# GitOps Runner

## Purpose
The project aims to deploy the application of distribution to target server behind the firewall.

## How to install

```
curl https://raw.githubusercontent.com/wusung/gitops-runner/master/install.sh | bash -s -- -r=/var/www -a=gitops-runner -p=3030
```

## Check the service with systemd

```shell
service gitops-runner status
```

## How to uninstall

```shell
rm /etc/systemd/system/gitops-runner.service
rm -rf /var/lib/gitops-runner
rm -rf /opt/gitops-runner
```
