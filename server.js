const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const util = require('util');
const decompress = require('decompress');
const { pipeline } = require('stream');
const {
  formatDate,
  ensurePath,
  resolveHome,
  createKey,
  createHash,
} = require('./utils');

const pump = util.promisify(pipeline);
const bearerAuthPlugin = require('fastify-bearer-auth');
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
const WORKING_PATH = resolveHome(program.workingPath || '~/.gitlab-deploy');
const APP_PATH = resolveHome(program.appPath || '/var/lib/www');

function getEncrypedKey() {
  return fs.readFileSync(KEY_PATH, 'utf-8').trim();
}

createKey(KEY_PATH);

fastify.register(bearerAuthPlugin, {
  auth: (key, req) => new String(createHash(key)) == getEncrypedKey(),
});
fastify.register(require('fastify-multipart'));

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
    await decompress(target, deployPath, { strip: 1 });
  else {
    fs.copyFileSync(target, deployPath);
  }
  console.log(`${deployPath} uploaded.`);

  const wwwPath = `${APP_PATH}/${appName}`;
  console.log(`${wwwPath} deployed.`);
  if (fs.existsSync(wwwPath)) fs.unlinkSync(wwwPath);
  fs.symlinkSync(deployPath, wwwPath);
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
