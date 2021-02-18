# deploy service

## How to install

```
curl https://raw.githubusercontent.com/wusung/gitlab-deploy/master/install.sh | bash -s -- -r=/var/www -a=deploy-service -p=3030
```

## Check the service with systemd

```shell
service deploy-service status
```

## How to uninstall

```shell
rm /etc/systemd/system/deploy-service.service
rm -rf /var/lib/deploy-service
rm -rf /opt/deploy-service
```
