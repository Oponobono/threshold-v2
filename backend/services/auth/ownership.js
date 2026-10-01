/**
 * Autorizacion por recurso (IDOR).
 *
 * El problema que esto cierra
 * --------------------------
 * Autenticar NO es autorizar. Autenticar responde a "quien eres"; autorizar
 * responde a "este recurso es tuyo". La app confunde las dos cosas de forma
 * sistematica: hay rutas donde el userId viaja en el PATH
 * (/ai/chat/history/:userId/:subjectId) y el controlador lo usa tal cual en la
 * consulta SQL. Con un token valido cualquiera, A leia y BORRABA el historial de
 * B escribiendo el id de B en la URL. No hacia falta la contrasena de B, ni su
 * email: solo su id.
 *
 * La regla
 * --------
 * El id de usuario SIEMPRE sale del token, nunca de la peticion. Si una ruta
 * acepta un userId por parametro, ese parametro se usa para COMPARAR, no para
 * consultar.
 *
 * Y un acceso denegado responde NOT_FOUND, no 403: un 403 confirma que el
 * recurso existe, y con eso basta para enumerar recursos ajenos probando ids.
 * "No existe" y "es de otro" tienen que ser la misma respuesta.
 */

const { sendAiError, esRutaAiV2 } = require('../ai/contracts/aiErrors');

/**
 * El id del usuario autenticado, o null si no lo hay.
 *
 * req.userId lo deja el middleware de auth a partir del JWT. El fallback a
 * req.user.id es por compatibilidad con controladores que solo tengan eso.
 */
function idPropio(req) {
    const directo = req && req.userId;
    if (directo !== undefined && directo !== null && directo !== '') return String(directo);

    const user = req && req.user;
    const alterno = user && (user.id !== undefined ? user.id : user.userId);
    if (alterno !== undefined && alterno !== null && alterno !== '') return String(alterno);

    // Sin identidad no hay autorizacion posible. Devolver null, y no un id
    // vacio, es lo que impide que "sin usuario" termine autorizando por el
    // hecho de compararse consigo mismo.
    return null;
}

/**
 * El recurso pertenece al usuario autenticado?
 *
 * Compara como texto porque el JWT puede llevar el id como numero (se firma
 * desde SQLite) y el parametro de ruta siempre es string. Una comparacion
 * estricta entre 7 y "7" daria "no es tuyo" sobre el recurso del propio
 * usuario, que es el fallo mas caro de detectar porque funciona en pruebas
 * manuales y falla en produccion segun como venga el id.
 */
function esPropio(req, ownerId) {
    const mio = idPropio(req);
    if (mio === null) return false;

    const suyo = ownerId === undefined || ownerId === null ? '' : String(ownerId);
    // Un ownerId vacio significa "no me has dicho de quien es". Sin identidad
    // que comparar no se autoriza: dar por suyo un recurso sin dueno es abrirlo.
    if (suyo === '') return false;

    return mio === suyo;
}

/**
 * Responde "no existe" en el dialecto que corresponda a la ruta.
 *
 * v2 -> NOT_FOUND con requestId. v1 -> texto plano, porque los builds instalados
 * del movil leen error como cadena.
 */
function enviarNoEncontrado(req, res, motivoInterno) {
    if (esRutaAiV2(req)) {
        return sendAiError(res, { code: 'ACCESS_DENIED', message: motivoInterno }, req.id);
    }
    return res.status(404).json({ error: 'Recurso no encontrado.' });
}

/**
 * Exige que el recurso indicado por el path sea del usuario autenticado.
 *
 * Pensado para las rutas que reciben el propietario en la URL. Si NO es suyo,
 * escribe la respuesta y devuelve true. Si es suyo, devuelve false y el
 * controlador sigue su curso normal.
 *
 *   const denegado = exigirPropiedadEnPath(req, res);
 *   if (denegado) return;
 *
 * @param {object} req
 * @param {object} res
 * @param {string} [nombreParam]
 * @returns {boolean} true si ya se ha respondido (acceso denegado)
 */
function exigirPropiedadEnPath(req, res, nombreParam = 'userId') {
    const pedido = req.params ? req.params[nombreParam] : undefined;

    if (esPropio(req, pedido)) return false;

    enviarNoEncontrado(req, res, `${nombreParam}=${pedido} pertenece a otro usuario`);
    return true;
}

function esVacio(valor) {
    return valor === undefined || valor === null || String(valor).trim() === '';
}

/**
 * Igual, pero para recursos con id propio (deck, documento, sesion...).
 *
 * resolver recibe el id y devuelve Promise de tres valores posibles:
 *   null  -> el recurso no existe
 *   true  -> es del usuario
 *   false -> existe y es de otro
 *
 * Los tres casos que no son "es tuyo" responden exactamente lo mismo, para no
 * filtrar la existencia del recurso.
 *
 * @returns {Promise<boolean>} true si ya se ha respondido (acceso denegado)
 */
async function exigirPropiedadDeRecurso(req, res, id, resolver) {
    if (esVacio(id)) {
        enviarNoEncontrado(req, res, `id de recurso ausente: ${id}`);
        return true;
    }

    const dueno = await resolver(id);
    if (dueno === true) return false;

    enviarNoEncontrado(req, res, `recurso ${id} no pertenece al usuario`);
    return true;
}

module.exports = {
    idPropio,
    esPropio,
    enviarNoEncontrado,
    exigirPropiedadEnPath,
    exigirPropiedadDeRecurso,
};