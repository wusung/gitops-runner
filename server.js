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
  exec(`${APP_PATH}/run.sh`, (err, stdout, stderr) => {
    if (err) {
      // node couldn't execute the command
      console.log(`stdout: ${err}`)
      return;
    }

    // the *entire* stdout and stderr (buffered)
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
  })
  
  reply.send({
    status: 'ok'
  })
})

fastify.post('/deploy', async (req, reply) => {
  ensurePath(WORKING_PATH)
  ensurePath(APP_PATH)

  const options = { limits: { fileSize: 200 * 1000 * 1000 } };
  const data = await req.file(options);
  const target = path.join(WORKING_PATH, `${data.filename}`);
  await pump(data.file, fs.createWriteStream(target));
  let appName = `${path.basename(path.basename(data.filename, '.gz'), '.tar')}`;
  appName = `${path.basename(appName, '.zip')}`;

  const deployPath = path.join(WORKING_PATH, `${appName}_${formatDate(new Date())}`);
  if (data.filename.endsWith('.gz'))
    await decompress(target, deployPath);
  else if (data.filename.endsWith('.zip')) {
    await execSync(`unzip ${target} -d ${deployPath}`);
  } else {
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
        shellExec(`service ${name} restart`);
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
fastify.listen({ port: program.port || 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) throw err;
  console.log(`Server listening on ${address}`);
});
