const assert = require('../ConvergenceAssert');
const { v4: uuidv4 } = require('uuid');

/**
 * Escenario C: El delta sync retorna un grupo "antiguo" cuando el usuario
 * crea una membresía nueva para él.
 *
 * Invariante del protocolo:
 *   groups en delta = (grupos actualizados desde cursor) UNION (grupos accesibles
 *   via membresías nuevas desde cursor), incluso si el grupo no cambió.
 *
 * Diseño del test (un solo dispositivo, un solo usuario):
 * 1. Seedear el grupo directamente en el backend con sync_version = 1.
 * 2. Hacer un sync vacío para avanzar el cursor del dispositivo a ≥ 2.
 * 3. Crear la membresía para ese grupo → sync.
 * 4. Verificar que el delta devuelve el grupo a pesar de que
 *    group.sync_version (1) < cursor_antes_del_join (≥ 2).
 */
async function scenarioDeltaDeliversOldGroupOnJoin(env) {
  const a = new assert('013 — Scoped Groups: delta entrega grupo antiguo al crear membresía');
  const groupPinId = 'PIN-' + Math.floor(Math.random() * 9000 + 1000);
  const groupId = uuidv4();
  const membershipId = uuidv4();

  // 1. Seed el grupo con sync_version = 1 directamente en backend
  await new Promise((resolve, reject) => {
    env.backendDb.run(
      `INSERT INTO groups (id, group_pin_id, name, is_public, creator_user_id, sync_version) VALUES (?, ?, 'Old Group', 1, ?, 1)`,
      [groupId, groupPinId, env.userId],
      err => err ? reject(err) : resolve()
    );
  });
  // Bump la sync_version global del backend a 2 para que el grupo ya esté "por detrás" del cursor
  await new Promise((resolve) => {
    env.backendDb.run(`UPDATE sync_version SET version = version + 1 WHERE id = 1`, [], () => resolve());
  });

  // 2. Device A arranca con cursor 0 → initial sync → cursor = 2
  //    (el grupo aparece en initial porque el usuario tiene acceso como creator)
  //    Después de esto, si el usuario YA es creator, siempre verá el grupo.
  //    Para aislar el escenario: usamos un grupo donde el usuario NO es creator.
  const groupPinId2 = 'PIN2-' + Math.floor(Math.random() * 9000 + 1000);
  const groupId2 = uuidv4();
  const membershipId2 = uuidv4();

  // Seed el grupo con otro creator_user_id (un usuario fantasma)
  await new Promise((resolve, reject) => {
    env.backendDb.run(
      `INSERT INTO groups (id, group_pin_id, name, is_public, creator_user_id, sync_version) VALUES (?, ?, 'Shared Group', 1, 'other-user-uuid', 1)`,
      [groupId2, groupPinId2],
      err => err ? reject(err) : resolve()
    );
  });

  const A = await env.createDevice('A');

  // A hace sync: cursor avanza a ≥ 2 (ya superó la sync_version del grupo)
  await A.sync();
  const cursorAfterInitial = A.lastSyncVersion;
  a.equal(cursorAfterInitial >= 1, true, 'cursor de A avanzó en initial sync');

  // El grupo2 (otro creator) NO debería estar en local de A (sin membresía)
  const dumpA_before = await A.dumpAll();
  const hasGroup2Before = (dumpA_before.groups || []).some(g => g.group_pin_id === groupPinId2);
  a.equal(hasGroup2Before, false, 'A no tiene el grupo2 antes de unirse (sin membresía)');

  // 3. A crea membresía para el grupo2 → sync
  await A.op('group_memberships', 'CREATE', membershipId2, { group_pin_id: groupPinId2, role: 'member' });
  await A.sync();

  // 4. Verificar que A recibió el grupo2 aunque su sync_version (1) < cursor anterior (≥ 2)
  const dumpA_after = await A.dumpAll();
  const group2InA = (dumpA_after.groups || []).find(g => g.group_pin_id === groupPinId2);
  a.equal(group2InA != null, true, 'A recibió el grupo antiguo vía delta al crear membresía');
  a.equal(group2InA?.name, 'Shared Group', 'nombre del grupo es correcto');

  const mem2InA = (dumpA_after.group_memberships || []).find(m => m.id === membershipId2);
  a.equal(mem2InA != null, true, 'membresía de A persiste en local');

  await A.destroy();
  return a.report();
}

/**
 * Escenario D: Una membresía eliminada en el dispositivo A converge en B.
 *
 * Invariante:
 *   DELETE de membresía se propaga vía sync_deletions.
 *   Después de que B sincroniza, ya no tiene la membresía.
 *
 * Nota: El "pruning" del grupo (eliminarlo si ya no hay membresías) es una
 * decisión del CLIENTE (GroupMembershipRepository.deleteWithPruning).
 * El backend solo sincroniza la eliminación de la membresía.
 * Este escenario verifica la convergencia de la eliminación entre dispositivos.
 */
async function scenarioMembershipDeleteConverges(env) {
  const a = new assert('014 — Scoped Groups: eliminación de membresía converge entre dispositivos');
  const groupPinId = 'MDEL-' + Math.floor(Math.random() * 9000 + 1000);
  const groupId = uuidv4();
  const membershipId = uuidv4();

  // Seed del grupo
  await new Promise((resolve, reject) => {
    env.backendDb.run(
      `INSERT INTO groups (id, group_pin_id, name, is_public, creator_user_id, sync_version) VALUES (?, ?, 'MemberDel Group', 1, ?, 0)`,
      [groupId, groupPinId, env.userId],
      err => err ? reject(err) : resolve()
    );
  });

  const A = await env.createDevice('A');
  const B = await env.createDevice('B');

  // A crea la membresía y sincroniza
  await A.op('group_memberships', 'CREATE', membershipId, { group_pin_id: groupPinId, role: 'creator' });
  await A.sync();

  // B sincroniza y recibe la membresía
  await B.sync();
  const dumpB_before = await B.dumpAll();
  const memInB = (dumpB_before.group_memberships || []).find(m => m.id === membershipId);
  a.equal(memInB != null, true, 'B tiene la membresía antes de que A la elimine');

  // A elimina la membresía → sync
  await A.op('group_memberships', 'DELETE', membershipId, {});
  await A.sync();

  // B sincroniza → debe recibir la eliminación
  await B.sync();
  const dumpB_after = await B.dumpAll();
  const memInB_after = (dumpB_after.group_memberships || []).find(m => m.id === membershipId);
  a.equal(memInB_after == null, true, 'B ya no tiene la membresía eliminada por A');

  const dumpA_after = await A.dumpAll();
  const memInA_after = (dumpA_after.group_memberships || []).find(m => m.id === membershipId);
  a.equal(memInA_after == null, true, 'A tampoco tiene la membresía en local');

  await A.destroy();
  await B.destroy();
  return a.report();
}

module.exports = {
  scenarioDeltaDeliversOldGroupOnJoin,
  scenarioMembershipDeleteConverges,
};
