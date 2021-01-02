# Gitlab deploy

## How to install

```
curl https://raw.githubusercontent.com/wusung/gitlab-deploy/master/install.sh | bash -s -- -r=/var/lib/www -a=gitlab-deploy -p=3030
```

## Check the service with systemd

```shell
service gitlab-deploy status
```

## How to uninstall


rm /etc/systemd/system/igcash-deploy.service
rm -rf /var/lib/gitlab-deploy
rm -rf /opt/igcash-deploy
