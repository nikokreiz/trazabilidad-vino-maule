'use strict';
// Demo de punta a punta: ciclo de vida completo + dos intentos que deben ser rechazados.
const { enviar, consultar, mensajeError } = require('./cliente');
const db = require('./db');

const ID = process.argv[2] || `DEMO-${Date.now().toString().slice(-8)}`;

async function paso(titulo, fn) {
  console.log(`\n== ${titulo}`);
  try {
    const r = await fn();
    console.log(`   OK  tx ${r.txId.slice(0, 12)}…  bloque ${r.bloque}  estado: ${r.resultado.estadoActual || 'certificado emitido'}`);
    return r;
  } catch (e) {
    console.log(`   RECHAZADA: ${mensajeError(e)}`);
    return null;
  }
}

(async () => {
  console.log(`Lote de demo: ${ID}`);
  db.mostrar(db.listar({ limite: 10 }), 'ANTES del envío (últimas 10 transacciones)');

  await paso('1. Cosecha (invoca Org1, endosa Org1)', () =>
    enviar(1, 'registrarCosecha', [ID, 'Viñedo San Javier', 'Carmenere', '2026-03-20', 1500, 'prod-001']));

  await paso('2. Org2 intenta certificar (debe ser rechazada: no es la certificadora)', () =>
    enviar(2, 'registrarCertificacion', [ID, `CERT-${ID}`, 'DO Valle del Maule', '2026-04-10', 'emb-001'], ['Org2MSP']));

  await paso('3. Certificación (invoca Org3, endosan Org1 y Org3)', () =>
    enviar(3, 'registrarCertificacion', [ID, `CERT-${ID}`, 'DO Valle del Maule', '2026-04-10', 'cert-001']));

  await paso('4. Embotellar más de lo cosechado (debe ser rechazada: regla de negocio, 9999 > 1500)', () =>
    enviar(2, 'registrarEmbotellado', [ID, 9999, '2026-08-15', 'emb-001']));

  await paso('5. Embotellado endosado solo por Org1 (debe quedar INVALIDADO: la política exige Org2)', () =>
    enviar(2, 'registrarEmbotellado', [ID, 1200, '2026-08-15', 'emb-001'], ['Org1MSP']));

  await paso('6. Embotellado correcto (invoca y endosa Org2)', () =>
    enviar(2, 'registrarEmbotellado', [ID, 1200, '2026-08-15', 'emb-001']));

  await paso('7. Cambio de custodia (invoca Org4, endosan Org4 y Org1)', () =>
    enviar(4, 'registrarCambioCustodia', [ID, 'embotelladora-maule', 'exportador-andes', '2026-09-01', 'exp-001']));

  console.log('\n== Historial del lote (consulta de solo lectura)');
  const h = await consultar('consultarHistorial', [ID]);
  console.log(`   Estado actual: ${h.lote.estadoActual}`);
  for (const ev of h.eventos) {
    console.log(`   #${ev.secuencia} ${ev.tipoEvento.padEnd(16)} ${ev.mspId}  ${ev.timestamp}  tx ${ev.idEvento.slice(0, 12)}…`);
  }
  db.mostrar(db.listar({ idLote: ID }), `DESPUÉS del envío (lote ${ID})`);
  console.log(`\nVerificación pública: http://localhost:3000/verificar/${ID}`);
})().catch((e) => {
  console.error('Error en la demo:', mensajeError(e));
  process.exit(1);
});
