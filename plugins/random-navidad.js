import axios from 'axios';
const handler = async (m, {
  conn,
  args,
  usedPrefix,
  command,
}) => {
  const res = (await axios.get(`https://raw.githubusercontent.com/Ochoa21/XavyBot-MD/master/src/JSON/navidad.json`)).data;
  const mystic = await res[Math.floor(res.length * Math.random())];
  conn.sendMessage(m.chat, {
    image: {
      url: mystic,
    },
    caption: `_Navidad 🧑‍🎄_`,
  }, {
    quoted: m,
  });
};
handler.help = ['navidad'];
handler.tags = ['internet'];
handler.command = /^(navidad)$/i;
export default handler;
