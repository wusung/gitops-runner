# Gitlab deploy

## How to install

```
curl https://raw.githubusercontent.com/wusung/gitlab-deploy/master/install.sh | bash -s -- -r=/www/wwwroot1 -a=igcash-deploy -p=3030
```

## Check the service with systemd

```shell
service gitlab-deploy status
```

## How to uninstall

rm -rf /etc/systemd/system/gitlab-deploy
rm -rf /opt/gitlab-deploy
