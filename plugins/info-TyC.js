const handler = async (m, {conn}) => {
  m.reply(global.terminos);
};
handler.customPrefix = /términos y condiciones y privacidad|terminosycondicionesyprivacidad|terminosycondiciones|terminos y condiciones y privacidad|terminos y condiciones|terminos y condiciones|terminos de uso|Terminos de uso|Terminó se uso|términos de uso|Términos de uso|Términos y condiciones/i;
handler.command = new RegExp;
export default handler;

global.terminos = `no hagas spam o te quito el bot`;
