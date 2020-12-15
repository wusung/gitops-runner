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

const KEY_PATH = resolveHome('/var/lib/gitlab-deploy/gitlab-deploy.key');
const APP_PATH = resolveHome('/var/lib/gitlab-deploy');
const FINAL_PATH = '/var/lib/www';

function getEncrypedKey() {
  return fs.readFileSync(KEY_PATH, 'utf-8').trim();
}

createKey(KEY_PATH);

fastify.register(bearerAuthPlugin, {
  auth: (key, req) => new String(createHash(key)) == getEncrypedKey(),
});
fastify.register(require('fastify-multipart'));

fastify.post('/deploy', async (req, reply) => {
  ensurePath(path.dirname(APP_PATH));

  const options = { limits: { fileSize: 200 * 1000 * 1000 } };
  const data = await req.file(options);
  const target = path.join(APP_PATH, `${data.filename}`);
  await pump(data.file, fs.createWriteStream(target));
  const appName = `${path.basename(data.filename, '.gz')}`;

  const deployPath = path.join(APP_PATH, `${appName}_${formatDate(new Date())}`);
  await decompress(target, deployPath, { strip: 1 });
  console.log(`${deployPath} deployed.`);

  let wwwPath = `${FINAL_PATH}/${appName}`;
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
fastify.listen(3000, (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`);
});
