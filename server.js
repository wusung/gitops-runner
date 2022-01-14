const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { pipeline } = require('stream');
const {
  formatDate,
  ensurePath,
  resolveHome,
  createKey,
  createHash,
  decompress,
} = require('./utils');
const exec = require('child_process').exec;
const execSync = util.promisify(exec);
const shellExec = require('shell-exec');
const shellExecSync = util.promisify(shellExec);

const pump = util.promisify(pipeline);
const bearerAuthPlugin = require('fastify-bearer-auth');
const { setTimeout } = require('timers');
const fastify = require('fastify')({
  logger: false,
});

const program = new Command();
program
  .version('1.0.0')
  .option('-p, --port <port>', 'listening port')
  .option('-w, --working-path <path>', 'the working path')
  .option('-a, --app-path <path>', 'the application path')
  .option('-n, --app-name <name>', 'the application name');
program.parse(process.argv);

const APP_NAME = program.appName || 'deploy-service';
const KEY_PATH = resolveHome(`/var/lib/${APP_NAME}/${APP_NAME}.key`);
const WORKING_PATH = resolveHome(program.workingPath || '~/.deploy-service');
const APP_PATH = resolveHome(program.appPath || '/var/lib/www');

function getEncrypedKey() {
  return fs.readFileSync(KEY_PATH, 'utf-8').trim();
}

createKey(KEY_PATH);

fastify.register(bearerAuthPlugin, {
  auth: (key, req) => new String(createHash(key)) == getEncrypedKey(),
});
fastify.register(require('fastify-multipart'));

fastify.get('/start', async (req, reply) => {
  (async() => {
    console.log('start')
    console.log(await shellExecSync(`cd ${WORKING_PATH} && /usr/bin/git reset --hard HEAD`))
    await shellExecSync(`cd ${WORKING_PATH} && /usr/bin/git pull origin feature/202201 --rebase`)
    await shellExecSync(`cd ${WORKING_PATH} && ../dev.sh`)
    await shellExecSync(`cd ${WORKING_PATH} && mvn clean package && docker build . -t student/app:latest`)
    await shellExecSync(`cd ${WORKING_PATH} && docker-compose stop`)
    await shellExecSync(`cd ${WORKING_PATH} && docker-compose rm -f`)
    await shellExecSync(`cd ${WORKING_PATH} && docker-compose up -d`)
    console.log('start')
  })()
  reply.send({
    status: 'ok'
  })
})

fastify.post('/deploy', async (req, reply) => {
  ensurePath(WORKING_PATH);
  ensurePath(APP_PATH);

  const options = { limits: { fileSize: 200 * 1000 * 1000 } };
  const data = await req.file(options);
  const target = path.join(WORKING_PATH, `${data.filename}`);
  await pump(data.file, fs.createWriteStream(target));
  const appName = `${path.basename(path.basename(data.filename, '.gz'), '.tar')}`;

  const deployPath = path.join(WORKING_PATH, `${appName}_${formatDate(new Date())}`);
  if (data.filename.endsWith('.gz'))
    await decompress(target, deployPath);
  else {
    fs.copyFileSync(target, deployPath);
  }
  console.log(`${deployPath} uploaded.`);

  const wwwPath = `${APP_PATH}/${appName}`;
  console.log(`${wwwPath} deployed.`);
  if (fs.existsSync(wwwPath)) fs.unlinkSync(wwwPath);
  fs.symlinkSync(deployPath, wwwPath);

  setTimeout(async () => {
    const serviceName = `${wwwPath}/systemd/service-name`;
    if (fs.existsSync(serviceName)) {
      let name = new String(fs.readFileSync(serviceName)).trimEnd();
      if (fs.existsSync('/usr/sbin/service')) {
        await shellExecSync(`service ${name} restart`);
        console.log(`service ${name} restart`);
      } else {
        console.log(`The system does not support 'service ${name} restart'`);
      }
    }
  }, 5000);

  reply.send({
    name: data.filename,
    deploy: deployPath,
    target: wwwPath,
    nginx: `location / { root ${wwwPath}/; }`,
  });
});

// Run the server!
fastify.listen(program.port || 3000, (err, address) => {
  if (err) throw err;
  console.log(`Server listening on ${address}`);
});
