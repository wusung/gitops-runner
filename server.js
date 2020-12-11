const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const util = require('util');
const decompress = require('decompress');
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
const FINAL_PATH = '/var/lib/www';

function ensurePath(pathname) {
  if (!fs.existsSync(resolveHome(pathname))) {
    fs.mkdirSync(resolveHome(pathname), { recursive: true });
  }
}

function formatDate(date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  let year = '' + d.getFullYear();
  let hours = '' + d.getHours();
  let minutes = '' + d.getMinutes();
  let seconds = '' + d.getSeconds();

  if (month.length < 2)
    month = '0' + month;
  if (day.length < 2)
    day = '0' + day;
  if (hours.length < 2)
    hours = '0' + hours;
  if (minutes.length < 2)
    minutes = '0' + minutes;
  if (seconds.length < 2)
    seconds = '0' + seconds;

  return [year, month, day, hours, minutes, seconds].join('');
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
  });
});

// Run the server!
fastify.listen(3000, (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`);
});
