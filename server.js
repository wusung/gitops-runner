const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { v4: uuid } = require('uuid');
const { pipeline } = require('stream');

const pump = util.promisify(pipeline);
const bearerAuthPlugin = require('fastify-bearer-auth');
const fastify = require('fastify')({
  logger: false,
});

function resolveHome(filepath) {
  if (filepath[0] === '~') {
    return path.join(process.env.HOME, filepath.slice(1));
  }
  return filepath;
}

const KEY_PATH = resolveHome('~/.gitlab-deploy/gitlab-deploy.key');
const DEPLOY_PATH = resolveHome('~/.gitlab-deploy');

function ensurePath(pathname) {
  if (!fs.existsSync(resolveHome(pathname))) {
    fs.mkdirSync(resolveHome(pathname), { recursive: true });
  }
}

function createKey() {
  ensurePath(path.dirname(KEY_PATH));

  if (!fs.existsSync(KEY_PATH)) {
    const key = uuid();

    fs.writeFileSync(KEY_PATH, crypto.createHash('sha256').update(key).digest('base64'));
    console.log(`Please write down the key. You can delete ${KEY_PATH} if you forget the key.`);
    console.log(`key = ${key}`);
  }
}

function createHash(str) {
  return crypto.createHash('sha256').update(str).digest('base64');
}

function getEncrypedKey() {
  return fs.readFileSync(KEY_PATH, 'utf-8').trim();
}

createKey();

fastify.register(bearerAuthPlugin, {
  auth: (key, req) => new String(createHash(key)) == getEncrypedKey(),
});
fastify.register(require('fastify-multipart'));

fastify.post('/deploy', async (req, reply) => {
  ensurePath(path.dirname(DEPLOY_PATH));

  const options = { limits: { fileSize: 200 * 1000 * 1000 } };
  const data = await req.file(options);
  const target = path.join(DEPLOY_PATH, data.filename);

  console.log(`deploying to ${target}`);
  await pump(data.file, fs.createWriteStream(target));
  console.log(`deployed to ${target}`);
  reply.send({
    name: data.filename,
    mimetype: data.mimetype,
  });
});

// Run the server!
fastify.listen(3000, (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`);
});
