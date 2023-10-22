process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
import './config.js';
import './api.js';
import {createRequire} from 'module';
import path, {join} from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {platform} from 'process';
import * as ws from 'ws';
import {readdirSync, statSync, unlinkSync, existsSync, readFileSync, rmSync, watch} from 'fs';
import yargs from 'yargs';
import {spawn} from 'child_process';
import lodash from 'lodash';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import {tmpdir} from 'os';
import {format} from 'util';
import P from 'pino';
import pino from 'pino';
import {Boom} from '@hapi/boom';
import {makeWASocket, protoType, serialize} from './lib/simple.js';
import {Low, JSONFile} from 'lowdb';
import {mongoDB, mongoDBV2} from './lib/mongoDB.js';
import store from './lib/store.js';
const {proto} = (await import('@whiskeysockets/baileys')).default;
const {DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, makeCacheableSignalKeyStore} = await import('@whiskeysockets/baileys');
const {CONNECTING} = ws;
const {chain} = lodash;
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

protoType();
serialize();

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
}; global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true));
}; global.__require = function require(dir = import.meta.url) {
  return createRequire(dir);
};

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({...query, ...(apikeyqueryname ? {[apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name]} : {})})) : '');

global.timestamp = {start: new Date};
global.videoList = [];
global.videoListXXX = [];

const __dirname = global.__dirname(import.meta.url);

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp('^[' + (opts['prefix'] || '!').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']');

global.db = new Low(/https?:\/\//.test(opts['db'] || '') ? new cloudDBAdapter(opts['db']) : new JSONFile(`${opts._[0] ? opts._[0] + '_' : ''}database.json`));

global.DATABASE = global.db; 
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) {
    return new Promise((resolve) => setInterval(async function() {
      if (!global.db.READ) {
        clearInterval(this);
        resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
      }
    }, 1 * 1000));
  }
  if (global.db.data !== null) return;
  global.db.READ = true;
  await global.db.read().catch(console.error);
  global.db.READ = null;
  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    ...(global.db.data || {}),
  };
  global.db.chain = chain(global.db.data);
};
loadDatabase();

global.chatgpt = new Low(new JSONFile(path.join(__dirname, '/db/chatgpt.json')));
global.loadChatgptDB = async function loadChatgptDB() {
  if (global.chatgpt.READ) {
    return new Promise((resolve) =>
      setInterval(async function() {
        if (!global.chatgpt.READ) {
          clearInterval(this);
          resolve( global.chatgpt.data === null ? global.loadChatgptDB() : global.chatgpt.data );
        }
      }, 1 * 1000));
  }
  if (global.chatgpt.data !== null) return;
  global.chatgpt.READ = true;
  await global.chatgpt.read().catch(console.error);
  global.chatgpt.READ = null;
  global.chatgpt.data = {
    users: {},
    ...(global.chatgpt.data || {}),
  };
  global.chatgpt.chain = lodash.chain(global.chatgpt.data);
};
loadChatgptDB();

/* ------------------------------------------------*/

global.authFile = `SessionFile`;
const {state, saveState, saveCreds} = await useMultiFileAuthState(global.authFile);
const msgRetryCounterMap = (MessageRetryMap) => { };
const {version} = await fetchLatestBaileysVersion();

const connectionOptions = {
  printQRInTerminal: true,
  patchMessageBeforeSending: (message) => {
    const requiresPatch = !!( message.buttonsMessage || message.templateMessage || message.listMessage );
    if (requiresPatch) {
      message = {viewOnceMessage: {message: {messageContextInfo: {deviceListMetadataVersion: 2, deviceListMetadata: {}}, ...message}}};
    }
    return message;
  },
  getMessage: async (key) => {
    if (store) {
      const msg = await store.loadMessage(key.remoteJid, key.id);
      return conn.chats[key.remoteJid] && conn.chats[key.remoteJid].messages[key.id] ? conn.chats[key.remoteJid].messages[key.id].message : undefined;
    }
    return proto.Message.fromObject({});
  },
  msgRetryCounterMap,
  logger: pino({level: 'silent'}),
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, pino({level: 'silent'})),
  },
  browser: ['XavyBot', 'Safari', '1.0.0'],
  version,
  defaultQueryTimeoutMs: undefined,
};

global.conn = makeWASocket(connectionOptions);
conn.isInit = false;
conn.well = false;
conn.logger.info(`Ƈᴀʀɢᴀɴᴅᴏ．．．\n`);

if (!opts['test']) {
  if (global.db) {
    setInterval(async () => {
      if (global.db.data) await global.db.write();
      if (opts['autocleartmp'] && (global.support || {}).find) (tmp = [os.tmpdir(), 'tmp', 'jadibts'], tmp.forEach((filename) => cp.spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete'])));
    }, 30 * 1000);
  }
}

if (opts['server']) (await import('./server.js')).default(global.conn, PORT);

function clearTmp() {
  const tmp = [tmpdir(), join(__dirname, './tmp')];
  const filename = [];
  tmp.forEach((dirname) => readdirSync(dirname).forEach((file) => filename.push(join(dirname, file))));
  return filename.map((file) => {
    const stats = statSync(file);
    if (stats.isFile() && (Date.now() - stats.mtimeMs >= 1000 * 60 * 3)) return unlinkSync(file); // 3 minutes
    return false;
  });
}

function purgeSession() {
let prekey = []
let directorio = readdirSync("./SessionFile")
let filesFolderPreKeys = directorio.filter(file => {
return file.startsWith('pre-key-') /*|| file.startsWith('session-') || file.startsWith('sender-') || file.startsWith('app-') */
})
prekey = [...prekey, ...filesFolderPreKeys]
filesFolderPreKeys.forEach(files => {
unlinkSync(`./SessionFile/${files}`)
})
} 

function purgeSessionSB() {
try {
let listaDirectorios = readdirSync('./jadibts/');
let SBprekey = []
listaDirectorios.forEach(directorio => {
if (statSync(`./jadibts/${directorio}`).isDirectory()) {
let DSBPreKeys = readdirSync(`./jadibts/${directorio}`).filter(fileInDir => {
return fileInDir.startsWith('pre-key-') /*|| fileInDir.startsWith('app-') || fileInDir.startsWith('session-')*/
})
SBprekey = [...SBprekey, ...DSBPreKeys]
DSBPreKeys.forEach(fileInDir => {
unlinkSync(`./jadibts/${directorio}/${fileInDir}`)
})
}
})
if (SBprekey.length === 0) return; //console.log(chalk.cyanBright(`=> No hay archivos por eliminar.`))
} catch (err) {
console.log(chalk.bold.red(`=> Algo salio mal durante la eliminación, archivos no eliminados`))
}}

function purgeOldFiles() {
const directories = ['./SessionFile/', './jadibts/']
const oneHourAgo = Date.now() - (60 * 60 * 1000)
directories.forEach(dir => {
readdirSync(dir, (err, files) => {
if (err) throw err
files.forEach(file => {
const filePath = path.join(dir, file)
stat(filePath, (err, stats) => {
if (err) throw err;
if (stats.isFile() && stats.mtimeMs < oneHourAgo && file !== 'creds.json') { 
unlinkSync(filePath, err => {  
if (err) throw err
console.log(chalk.bold.green(`Archivo ${file} borrado con éxito`))
})
} else {  
console.log(chalk.bold.red(`Archivo ${file} no borrado` + err))
} }) }) }) })
}

async function connectionUpdate(update) {
  const {connection, lastDisconnect, isNewLogin} = update;
  global.stopped = connection;
  if (isNewLogin) conn.isInit = true;
  const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
  if (code && code !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
    await global.reloadHandler(true).catch(console.error);
    //console.log(await global.reloadHandler(true).catch(console.error));
    global.timestamp.connect = new Date;
  }
  if (global.db.data == null) loadDatabase();
  if (update.qr != 0 && update.qr != undefined) {
    console.log(chalk.yellow('𝔼𝕤𝕔𝕒𝕟𝕖𝕖 𝕖𝕤𝕥𝕖 𝕔𝕠𝕕𝕚𝕘𝕠 𝕔𝕒𝕣𝕖𝕔𝕙𝕚𝕞𝕓𝕒 '));
  }
  if (connection == 'open') {
    console.log(chalk.yellow('▣──────────────────────────────···\n│\n│❧ 𝕃𝕚𝕤𝕥𝕠 𝕘𝕠𝕟𝕠𝕣𝕣𝕖𝕒 𝕪𝕒 𝕤𝕖 𝕔𝕠𝕟𝕖𝕔𝕥𝕠 \n│\n▣──────────────────────────────···'));
  }
let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
if (connection === 'close') {
    if (reason === DisconnectReason.badSession) {
        conn.logger.error(`[ ⚠ ] 𝕌𝕪 𝕓𝕣𝕠 𝕤𝕖 𝕕𝕒𝕟̃𝕠 𝕝𝕒 𝕤𝕖𝕤𝕚𝕠𝕟, 𝔼𝕝𝕚𝕞𝕚𝕟𝕒 𝕝𝕒 𝕔𝕒𝕣𝕡𝕖𝕥𝕒 ${global.authFile} y escanee el QR nuevamente`);
        //process.exit();
    } else if (reason === DisconnectReason.connectionClosed) {
        conn.logger.warn(`[ ⚠ ] 𝕊𝕖 𝕔𝕖𝕣𝕣𝕠 𝕝𝕒 𝕔𝕠𝕟𝕖𝕩𝕚𝕠𝕟, 𝕣𝕖𝕔𝕠𝕟𝕖𝕔𝕥𝕒𝕟𝕕𝕠....`);
        await global.reloadHandler(true).catch(console.error);
    } else if (reason === DisconnectReason.connectionLost) {
        conn.logger.warn(`[ ⚠ ] ℂ𝕠𝕟𝕖𝕩𝕚𝕠́𝕟 𝕡𝕖𝕣𝕕𝕚𝕕𝕒 𝕔𝕠𝕟 𝕖𝕝 𝕤𝕖𝕣𝕧𝕚𝕕𝕠𝕣, 𝕣𝕖𝕔𝕠𝕟𝕖𝕔𝕥𝕒𝕟𝕕𝕠...`);
        await global.reloadHandler(true).catch(console.error);
    } else if (reason === DisconnectReason.connectionReplaced) {
        conn.logger.error(`[ ⚠ ] ℂ𝕠𝕟𝕖𝕩𝕚𝕠́𝕟 𝕣𝕖𝕖𝕞𝕡𝕝𝕒𝕫𝕒𝕕𝕒, 𝕤𝕖 𝕙𝕒 𝕒𝕓𝕚𝕖𝕣𝕥𝕠 𝕠𝕥𝕣𝕒 𝕟𝕦𝕖𝕧𝕒 𝕤𝕖𝕤𝕚𝕠́𝕟. ℙ𝕠𝕣 𝕗𝕒𝕧𝕠𝕣, 𝕔𝕚𝕖𝕣𝕣𝕒 𝕝𝕒 𝕤𝕖𝕤𝕚𝕠́𝕟 𝕒𝕔𝕥𝕦𝕒𝕝 𝕡𝕣𝕚𝕞𝕖𝕣𝕠.`);
        //process.exit();
    } else if (reason === DisconnectReason.loggedOut) {
        conn.logger.error(`[ ⚠ ] ℂ𝕠𝕟𝕖𝕩𝕚𝕠𝕟 𝕔𝕖𝕣𝕣𝕒𝕕𝕒, 𝕡𝕠𝕣 𝕗𝕒𝕧𝕠𝕣 𝕖𝕝𝕚𝕞𝕚𝕟𝕒 𝕝𝕒 𝕔𝕒𝕣𝕡𝕖𝕥𝕒 ${global.authFile} 𝕪 𝕖𝕤𝕔𝕒𝕟𝕖𝕒 𝕟𝕦𝕖𝕧𝕒𝕞𝕖𝕟𝕥𝕖.`);
        //process.exit();
    } else if (reason === DisconnectReason.restartRequired) {
        conn.logger.info(`[ ⚠ ] ℝ𝕖𝕚𝕟𝕚𝕔𝕚𝕠 𝕟𝕖𝕔𝕖𝕤𝕒𝕣𝕚𝕠, 𝕣𝕖𝕚𝕟𝕚𝕔𝕚𝕖 𝕖𝕝 𝕤𝕖𝕣𝕧𝕚𝕕𝕠𝕣 𝕤𝕚 𝕡𝕣𝕖𝕤𝕖𝕟𝕥𝕒 𝕒𝕝𝕘𝕦́𝕟 𝕡𝕣𝕠𝕓𝕝𝕖𝕞𝕒.`);
        await global.reloadHandler(true).catch(console.error);
    } else if (reason === DisconnectReason.timedOut) {
        conn.logger.warn(`[ ⚠ ] 𝕋𝕚𝕖𝕞𝕡𝕠 𝕕𝕖 𝕔𝕠𝕟𝕖𝕩𝕚𝕠́𝕟 𝕒𝕘𝕠𝕥𝕒𝕕𝕠, 𝕣𝕖𝕔𝕠𝕟𝕖𝕔𝕥𝕒𝕟𝕕𝕠...`);
        await global.reloadHandler(true).catch(console.error);
    } else {
        conn.logger.warn(`[ ⚠ ] ℝ𝕒𝕫𝕠́𝕟 𝕕𝕖 𝕕𝕖𝕤𝕔𝕠𝕟𝕖𝕩𝕚𝕠́𝕟 𝕕𝕖𝕤𝕔𝕠𝕟𝕠𝕔𝕚𝕕𝕒. ${reason || ''}: ${connection || ''}`);
        await global.reloadHandler(true).catch(console.error);
    }
}
  /*if (connection == 'close') {
    console.log(chalk.yellow(`🚩ㅤConexion cerrada, por favor borre la carpeta ${global.authFile} y reescanee el codigo QR`));
  }*/
}

process.on('uncaughtException', console.error);

let isInit = true;
let handler = await import('./handler.js');
global.reloadHandler = async function(restatConn) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
    if (Object.keys(Handler || {}).length) handler = Handler;
  } catch (e) {
    console.error(e);
  }
  if (restatConn) {
    const oldChats = global.conn.chats;
    try {
      global.conn.ws.close();
    } catch { }
    conn.ev.removeAllListeners();
    global.conn = makeWASocket(connectionOptions, {chats: oldChats});
    isInit = true;
  }
  if (!isInit) {
    conn.ev.off('messages.upsert', conn.handler);
    conn.ev.off('group-participants.update', conn.participantsUpdate);
    conn.ev.off('groups.update', conn.groupsUpdate);
    conn.ev.off('message.delete', conn.onDelete);
    conn.ev.off('call', conn.onCall);
    conn.ev.off('connection.update', conn.connectionUpdate);
    conn.ev.off('creds.update', conn.credsUpdate);
  }

  conn.welcome = '*╔══════════════*\n*╟❧ @subject*\n*╠══════════════*\n*╟❧ @user*\n*╟❧ 𝔹𝕚𝕖𝕟𝕧𝕖𝕟𝕚𝕕𝕠 𝕤𝕖𝕒𝕤 𝕘𝕣𝕒𝕟 𝕡𝕦𝕥𝕒*\n*╟❧ 𝕃𝕖𝕖 𝕝𝕒 𝕕𝕖𝕤𝕔𝕣𝕚𝕡𝕔𝕚𝕠𝕟 𝕠 𝕤𝕚 𝕟𝕠 𝕝𝕠𝕤 𝕒𝕕𝕞𝕚𝕟𝕤 𝕥𝕖 𝕕𝕒𝕣𝕒𝕟 𝕡𝕒𝕠 𝕡𝕒𝕠*\n\n@desc\n\n*║*\n*╟❧ 𝔻𝕚𝕤𝕗𝕣𝕦𝕥𝕒 𝕤𝕚 𝕖𝕤 𝕢𝕦𝕖 𝕖𝕤𝕥𝕠𝕤 𝕧𝕚𝕣𝕘𝕖𝕟𝕖𝕤 𝕥𝕖 𝕕𝕖𝕛𝕒𝕟*\n*╚══════════════*';
  conn.bye = '*╔══════════════*\n*╟❧ @user*\n*╟❧ ℂ𝕙𝕒𝕠 𝕘𝕠𝕟𝕠𝕣𝕣𝕖𝕒, 𝕠𝕛𝕒𝕝𝕒 𝕟𝕠 𝕧𝕦𝕖𝕝𝕧𝕒 𝕡𝕚𝕣𝕠𝕓𝕠* \n*╚══════════════*';
  conn.spromote = '*@user 𝔸𝕙𝕠𝕣𝕒 𝕖𝕤 𝕞𝕚 𝕟𝕦𝕖𝕧𝕠 𝕛𝕖𝕗𝕖*';
  conn.sdemote = '*@user 𝕁𝔸𝕁𝔸𝕁𝔸𝕁𝔸, 𝕪𝕒 𝕟𝕠 𝕖𝕣𝕖𝕤 𝕞𝕚 𝕛𝕖𝕗𝕖*';
  conn.sDesc = '*𝔼𝕤𝕥𝕠𝕤 𝕒𝕕𝕞𝕚𝕟𝕤 𝕔𝕒𝕟𝕤𝕠𝕟𝕖𝕤 𝕪𝕒 𝕔𝕒𝕞𝕓𝕚𝕒𝕣𝕠𝕟 𝕝𝕒 𝕕𝕖𝕤𝕔𝕣𝕚𝕡𝕔𝕚𝕠𝕟*\n\n*𝕃𝕖𝕖 𝕝𝕒 𝕟𝕦𝕖𝕧𝕒 𝕕𝕖𝕤𝕔𝕣𝕚𝕡𝕔𝕚𝕠𝕟 𝕒𝕔𝕒 * @desc';
  conn.sSubject = '*𝕊𝕖 𝕔𝕒𝕞𝕓𝕚𝕠 𝕖𝕝 𝕟𝕠𝕞𝕓𝕣𝕖 𝕕𝕖𝕝 𝕘𝕣𝕦𝕡𝕠*\n*𝔼𝕝 𝕟𝕦𝕖𝕧𝕠 𝕟𝕠𝕞𝕓𝕣𝕖 𝕖𝕤:* @subject';
  conn.sIcon = '*𝕊𝕖 𝕔𝕒𝕞𝕓𝕚𝕠 𝕝𝕒 𝕗𝕠𝕥𝕠 𝕕𝕖𝕝 𝕘𝕣𝕦𝕡𝕠*';
  conn.sRevoke = '*𝕊𝕖 𝕒𝕔𝕥𝕦𝕒𝕝𝕚𝕫𝕠 𝕖𝕝 𝕝𝕚𝕟𝕜 𝕕𝕖𝕝 𝕘𝕣𝕦𝕡𝕠*\n*𝔼𝕝 𝕟𝕦𝕖𝕧𝕠 𝕝𝕚𝕟𝕜 𝕖𝕤:* @revoke';

  conn.handler = handler.handler.bind(global.conn);
  conn.participantsUpdate = handler.participantsUpdate.bind(global.conn);
  conn.groupsUpdate = handler.groupsUpdate.bind(global.conn);
  conn.onDelete = handler.deleteUpdate.bind(global.conn);
  conn.onCall = handler.callUpdate.bind(global.conn);
  conn.connectionUpdate = connectionUpdate.bind(global.conn);
  conn.credsUpdate = saveCreds.bind(global.conn, true);

  const currentDateTime = new Date();
  const messageDateTime = new Date(conn.ev);
  if (currentDateTime >= messageDateTime) {
    const chats = Object.entries(conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0]);
  } else {
    const chats = Object.entries(conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0]);
  }

  conn.ev.on('messages.upsert', conn.handler);
  conn.ev.on('group-participants.update', conn.participantsUpdate);
  conn.ev.on('groups.update', conn.groupsUpdate);
  conn.ev.on('message.delete', conn.onDelete);
  conn.ev.on('call', conn.onCall);
  conn.ev.on('connection.update', conn.connectionUpdate);
  conn.ev.on('creds.update', conn.credsUpdate);
  isInit = false;
  return true;
};

/*

const pluginFolder = join(__dirname, './plugins');
const pluginFilter = filename => /\.js$/.test(filename);
global.plugins = {};

async function filesInit(folder) {
  for (let filename of readdirSync(folder).filter(pluginFilter)) {
    try {
      let file = join(folder, filename);
      const module = await import(file);
      global.plugins[file] = module.default || module;
    } catch (e) {
      console.error(e);
      delete global.plugins[filename];
    }
  }

  for (let subfolder of readdirSync(folder)) {
    const subfolderPath = join(folder, subfolder);
    if (statSync(subfolderPath).isDirectory()) {
      await filesInit(subfolderPath);
    }
  }
}

await filesInit(pluginFolder).then(_ => Object.keys(global.plugins)).catch(console.error);

*/

const pluginFolder = global.__dirname(join(__dirname, './plugins/index'));
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};
async function filesInit() {
  for (const filename of readdirSync(pluginFolder).filter(pluginFilter)) {
    try {
      const file = global.__filename(join(pluginFolder, filename));
      const module = await import(file);
      global.plugins[filename] = module.default || module;
    } catch (e) {
      conn.logger.error(e);
      delete global.plugins[filename];
    }
  }
}
filesInit().then((_) => Object.keys(global.plugins)).catch(console.error);

global.reload = async (_ev, filename) => {
  if (pluginFilter(filename)) {
    const dir = global.__filename(join(pluginFolder, filename), true);
    if (filename in global.plugins) {
      if (existsSync(dir)) conn.logger.info(` updated plugin - '${filename}'`);
      else {
        conn.logger.warn(`deleted plugin - '${filename}'`);
        return delete global.plugins[filename];
      }
    } else conn.logger.info(`new plugin - '${filename}'`);
    const err = syntaxerror(readFileSync(dir), filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
    });
    if (err) conn.logger.error(`syntax error while loading '${filename}'\n${format(err)}`);
    else {
      try {
        const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`));
        global.plugins[filename] = module.default || module;
      } catch (e) {
        conn.logger.error(`error require plugin '${filename}\n${format(e)}'`);
      } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
      }
    }
  }
};
Object.freeze(global.reload);
watch(pluginFolder, global.reload);
await global.reloadHandler();
async function _quickTest() {
  const test = await Promise.all([
    spawn('ffmpeg'),
    spawn('ffprobe'),
    spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
    spawn('convert'),
    spawn('magick'),
    spawn('gm'),
    spawn('find', ['--version']),
  ].map((p) => {
    return Promise.race([
      new Promise((resolve) => {
        p.on('close', (code) => {
          resolve(code !== 127);
        });
      }),
      new Promise((resolve) => {
        p.on('error', (_) => resolve(false));
      })]);
  }));
  const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test;
  const s = global.support = {ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find};
  Object.freeze(global.support);
}
setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) return;
  const a = await clearTmp();
  console.log(chalk.cyanBright(`\n▣───────────[ 𝙰𝚄𝚃𝙾𝙲𝙻𝙴𝙰𝚁TMP ]──────────────···\n│\n▣─❧ 𝙰𝚁𝙲𝙷𝙸𝚅𝙾𝚂 𝙴𝙻𝙸𝙼𝙸𝙽𝙰𝙳𝙾𝚂 ✅\n│\n▣───────────────────────────────────────···\n`));
}, 180000);
setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) return;
  await purgeSession();
  console.log(chalk.cyanBright(`\n▣────────[ AUTOPURGESESSIONS ]───────────···\n│\n▣─❧ ARCHIVOS ELIMINADOS ✅\n│\n▣────────────────────────────────────···\n`));
}, 1000 * 60 * 60);
setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) return;
  await purgeSessionSB();
  console.log(chalk.cyanBright(`\n▣────────[ AUTO_PURGE_SESSIONS_SUB-BOTS ]───────────···\n│\n▣─❧ ARCHIVOS ELIMINADOS ✅\n│\n▣────────────────────────────────────···\n`));
}, 1000 * 60 * 60);
setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) return;
  await purgeOldFiles();
  console.log(chalk.cyanBright(`\n▣────────[ AUTO_PURGE_OLDFILES ]───────────···\n│\n▣─❧ ARCHIVOS ELIMINADOS ✅\n│\n▣────────────────────────────────────···\n`));
}, 1000 * 60 * 60);
setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) return;
  const status = global.db.data.settings[conn.user.jid] || {};
  const _uptime = process.uptime() * 1000;
  const uptime = clockString(_uptime);
  const bio = `𝕋𝕚𝕖𝕞𝕡𝕠 𝕒𝕔𝕥𝕚𝕧𝕠: ${uptime} ┃ 𝔹𝕪 𝕆𝕔𝕙𝕠𝕒`;
  await conn.updateProfileStatus(bio).catch((_) => _);
}, 60000);
function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return [d, ' Día(s) ️', h, ' Hora(s) ', m, ' Minuto(s) ', s, ' Segundo(s) '].map((v) => v.toString().padStart(2, 0)).join('');
}
_quickTest().catch(console.error);
