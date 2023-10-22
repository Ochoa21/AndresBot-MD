import { generateWAMessageFromContent } from "@whiskeysockets/baileys";
import os from "os";
import util from "util";
import sizeFormatter from "human-readable";
import MessageType from "@whiskeysockets/baileys";
import fs from "fs";
import { performance } from "perf_hooks";
const handler = async (m, { conn, usedPrefix }) => {
  const _uptime = process.uptime() * 1000;
  const uptime = clockString(_uptime);
  const totalreg = Object.keys(global.db.data.users).length;
  const chats = Object.entries(conn.chats).filter(
    ([id, data]) => id && data.isChats,
  );
  const groupsIn = chats.filter(([id]) => id.endsWith("@g.us"));
  const groups = chats.filter(([id]) => id.endsWith("@g.us"));
  const used = process.memoryUsage();
  const { restrict, antiCall, antiprivado, modejadibot } =
    global.db.data.settings[conn.user.jid] || {};
  const { autoread, gconly, pconly, self } = global.opts || {};
  const old = performance.now();
  const neww = performance.now();
  const speed = neww - old;
  const info = `
╠═〘 𝕀𝕟𝕗𝕠 𝕕𝕖𝕝 𝕓𝕠𝕥 〙 ═
╠
╠➥ ℂ𝕣𝕖𝕒𝕕𝕠𝕣: *𝕆𝕔𝕙𝕠𝕒*
╠➥ ℕ𝕦𝕞𝕖𝕣𝕠: *+57 3144 622 4366*
╠➥ ℙ𝕣𝕖𝕗𝕚𝕛𝕠: *${usedPrefix}*
╠➥ ℂ𝕙𝕒𝕥𝕤 𝕡𝕣𝕚𝕧𝕒𝕕𝕠𝕤: *${chats.length - groups.length}*
╠➥ ℂ𝕙𝕒𝕥𝕤 𝕕𝕖 𝕘𝕣𝕦𝕡𝕠𝕤: *${groups.length}* 
╠➥ ℂ𝕙𝕒𝕥𝕤 𝕥𝕠𝕥𝕒𝕝𝕖𝕤: *${chats.length}* 
╠➥ 𝔸𝕔𝕥𝕚𝕧𝕚𝕕𝕒𝕕: *${uptime}*
╠➥ ℙ𝕝𝕒𝕥𝕒𝕗𝕠𝕣𝕞𝕒: *${os.platform()}*
╠➥ 𝕌𝕤𝕦𝕒𝕣𝕚𝕠𝕤: *${totalreg} 𝚗𝚞𝚖𝚎𝚛𝚘𝚜*
╠➥ ℝ𝕖𝕤𝕥𝕣𝕚𝕔𝕥: ${restrict ? "*𝚊𝚌𝚝𝚒𝚟𝚊𝚍𝚘*" : "*𝚍𝚎𝚜𝚊𝚌𝚝𝚒𝚟𝚊𝚍𝚘*"} 
╠➥ 𝕄𝕠𝕕𝕠: ${self ? "*𝚙𝚛𝚒𝚟𝚊𝚍𝚘*" : "*𝚙𝚞𝚋𝚕𝚒𝚌𝚘*"}
╠➥ 𝕍𝕖𝕝𝕠𝕔𝕚𝕕𝕒𝕕: 
╠  *${speed} ms* 
╠
╠═〘 𝕏𝕒𝕧𝕪𝔹𝕠𝕥 〙 ═
`.trim();
  const doc = [
    "pdf",
    "zip",
    "vnd.openxmlformats-officedocument.presentationml.presentation",
    "vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const document = doc[Math.floor(Math.random() * doc.length)];
  const Message = {
    document: { url: `https://github.com/Ochoa21/XavyBot-MD` },
    mimetype: `application/${document}`,
    fileName: `「  𝕏𝕒𝕧𝕪𝔹𝕠𝕥 」`,
    fileLength: 99999999999999,
    pageCount: 200,
    contextInfo: {
      forwardingScore: 200,
      isForwarded: true,
      externalAdReply: {
        mediaUrl: "https://github.com/Ochoa21/XavyBot-MD",
        mediaType: 2,
        previewType: "pdf",
        title: "El mejor bot de whatsapp",
        body: wm,
        thumbnail: imagen1,
        sourceUrl: "www.instagram.com/ochoa_ocoro",
      },
    },
    caption: info,
    footer: wm,
    headerType: 6,
  };
  conn.sendMessage(m.chat, Message, { quoted: m });
};
handler.help = ["infobot", "speed"];
handler.tags = ["info", "tools"];
handler.command = /^(ping|info|infobot)$/i;
export default handler;

function clockString(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  console.log({ ms, h, m, s });
  return [h, m, s].map((v) => v.toString().padStart(2, 0)).join(":");
}