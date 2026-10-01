/**
 * Nucleo de verificacion de JWT, sin Express.
 *
 * Vive separado del middleware porque hay dos dialectos de respuesta (el
 * legacy `{error: "texto"}` y el sobre v2 `{error:{code,...}}`) y porque la
 * parte que decide si un token es valido no deberia depender de como se
 * responde. Verificar es una funcion; responder es otra.
 *
 * El motivo se distingue a proposito. El cliente solo necesita
 * UNAUTHENTICATED, pero el servidor tiene que poder diferenciar en el log
 * entre "no mandaron token", "mandaron basura" y "el token caducó": son tres
 * incidentes distintos y son tres sneezing clues distintas.
 */

const jwt = require('jsonwebtoken');
const secrets = require('../../config/secrets');

/** Motivos por los que se rechaza un token. Todos son "no autenticado" igual. */
const MOTIVO = {
  AUSENTE: 'ausente',
  MALFORMADO: 'malformado',
  CADUCADO: 'caducado',
  INVALIDO: 'invalido',
  SIN_SECRETO: 'sin_secreto_del_servidor',
};

/** Schema del header Authorization: solo Bearer, y con algo detras. */
const ESQUEMA_BEARER = /^Bearer[ ]+(\S+)$/i;

/**
 * Extrae el token del header Authorization.
 * Devuelve null si no hay header, si no usa Bearer, o si no trae token.
 */
function extraerToken(header) {
  if (typeof header !== 'string' || header.trim() === '') return null;
  const m = ESQUEMA_BEARER.exec(header.trim());
  return m ? m[1] : null;
}

/**
 * Verifica un token ya extraido.
 *
 * @param {string|null} token
 * @returns {{ok:true, user:object, userId:any}|{ok:false, motivo:string}}
 */
function verificarToken(token) {
  if (typeof token !== 'string' || token.trim() === '') {
    return { ok: false, motivo: MOTIVO.AUSENTE };
  }

  const secreto = secrets.JWT_SECRET;
  if (!secreto) {
    // El secreto es lo unico que impide falsificar un token. Sin el, TODOS los
    // tokens pasan y por eso es un incidente, no un 401 de usuario.
    return { ok: false, motivo: MOTIVO.SIN_SECRETO };
  }

  try {
    const user = jwt.verify(token, secreto);
    return { ok: true, user, userId: user.id };
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      return { ok: false, motivo: MOTIVO.CADUCADO };
    }
    if (err && typeof err.message === 'string' && err.message.includes('malformed')) {
      return { ok: false, motivo: MOTIVO.MALFORMADO };
    }
    // Firma invalida, o payload que no es el que esperamos.
    return { ok: false, motivo: MOTIVO.INVALIDO };
  }
}

/** Atajo: header -> veredicto. */
function verificarHeader(header) {
  return verificarToken(extraerToken(header));
}

module.exports = {
  MOTIVO,
  extraerToken,
  verificarToken,
  verificarHeader,
};