const crypto = require('crypto');
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
} = require('./utils');

const pump = util.promisify(pipeline);
const bearerAuthPlugin = require('fastify-bearer-auth');
const fastify = require('fastify')({
  logger: false,
});

const KEY_PATH = resolveHome('~/.gitlab-deploy/gitlab-deploy.key');
const DEPLOY_PATH = resolveHome('~/.gitlab-deploy');
const FINAL_PATH = '/var/lib/www';

function createHash(str) {
  return crypto.createHash('sha256').update(str).digest('base64');
}

function getEncrypedKey() {
  return fs.readFileSync(KEY_PATH, 'utf-8').trim();
}

createKey(KEY_PATH);

fastify.register(bearerAuthPlugin, {
  auth: (key, req) => new String(createHash(key)) == getEncrypedKey(),
});
fastify.register(require('fastify-multipart'));

fastify.post('/deploy', async (req, reply) => {
  ensurePath(path.dirname(DEPLOY_PATH));

  const options = { limits: { fileSize: 200 * 1000 * 1000 } };
  const data = await req.file(options);
  const target = path.join(DEPLOY_PATH, `${data.filename}`);
  await pump(data.file, fs.createWriteStream(target));

  const deployPath = path.join(DEPLOY_PATH, `${path.basename(data.filename, '.gz')}_${formatDate(new Date())}`);
  await decompress(target, deployPath);
  console.log(`${deployPath} deployed.`);

  if (fs.existsSync(FINAL_PATH)) fs.unlinkSync(FINAL_PATH);
  fs.symlinkSync(deployPath, FINAL_PATH);
  reply.send({
    name: data.filename,
    deploy: deployPath,
    target: `${FINAL_PATH}/${path.basename(data.filename, '.gz')}`,
    example: `api {  }`,
  });
});

// Run the server!
fastify.listen(3000, (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`);
});
