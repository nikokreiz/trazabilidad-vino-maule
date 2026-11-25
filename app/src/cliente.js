'use strict';
// Operaciones del chaincode TrazabilidadVino desde la aplicación cliente.
const { conectar, ORGS } = require('./fabric');
const db = require('./db');

// Organización que invoca y organizaciones que deben endosar cada función
// (coincide con las políticas del diseño y con el chaincode).
const ENDOSO = {
  registrarCosecha:        { invoca: 1, endosan: ['Org1MSP'] },
  registrarCertificacion:  { invoca: 3, endosan: ['Org1MSP', 'Org3MSP'] },
  registrarEmbotellado:    { invoca: 2, endosan: ['Org2MSP'] },
  registrarCambioCustodia: { invoca: 4, endosan: ['Org4MSP', 'Org1MSP'] },
};

const CODIGOS_INVALIDEZ = {
  10: 'ENDORSEMENT_POLICY_FAILURE (faltan firmas exigidas por la política)',
  11: 'MVCC_READ_CONFLICT (el lote cambió mientras se procesaba)',
};

function mensajeError(e) {
  if (e && Array.isArray(e.details) && e.details.length > 0) {
    return e.details.map((d) => d.message).join(' | ');
  }
  return (e && e.message) || String(e);
}

// Envía una transacción y espera su confirmación. Falla si queda INVALIDADA en el bloque.
// Cada envío queda registrado en la BD externa: PENDIENTE -> CONFIRMADA | RECHAZADA.
async function enviar(orgNum, funcion, args, endosan) {
  const config = ENDOSO[funcion];
  if (!config) throw new Error(`Función desconocida: ${funcion}`);
  const orgs = endosan || config.endosan;
  const c = conectar(orgNum);
  let idRegistro;
  try {
    const propuesta = c.contract.newProposal(funcion, {
      arguments: args.map(String),
      endorsingOrganizations: orgs,
    });
    idRegistro = db.registrarEnvio({
      funcion,
      idLote: String(args[0]),
      orgInvoca: ORGS[orgNum].msp,
      endosantes: orgs,
      txId: propuesta.getTransactionId(),
    });

    let transaccion;
    try {
      transaccion = await propuesta.endorse();              // 1. execute: los peers simulan y firman
    } catch (e) {
      db.marcarRechazada(idRegistro, { fase: 'ENDOSO', motivo: mensajeError(e) });
      throw e;
    }
    const resultado = Buffer.from(transaccion.getResult()).toString('utf8');
    const enviada = await transaccion.submit();             // 2. order: se envía al orderer
    const estado = await enviada.getStatus();               // 3. validate: espera la validación del bloque
    const bloque = Number(estado.blockNumber);
    if (!estado.successful) {
      const motivo = CODIGOS_INVALIDEZ[estado.code] || `código ${estado.code}`;
      db.marcarRechazada(idRegistro, { fase: 'VALIDACION', motivo, txId: estado.transactionId, bloque });
      throw new Error(`Transacción ${estado.transactionId.slice(0, 12)}… INVALIDADA en el bloque ${bloque}: ${motivo}`);
    }
    db.marcarConfirmada(idRegistro, { txId: estado.transactionId, bloque });
    return { txId: estado.transactionId, bloque, resultado: JSON.parse(resultado) };
  } finally {
    c.close();
  }
}

// Consulta de solo lectura (no genera transacción ni bloque).
async function consultar(funcion, args, orgNum = 1, usuario = 'User1') {
  const c = conectar(orgNum, usuario);
  try {
    const r = await c.contract.evaluateTransaction(funcion, ...args.map(String));
    return JSON.parse(Buffer.from(r).toString('utf8'));
  } finally {
    c.close();
  }
}

module.exports = { enviar, consultar, mensajeError, ENDOSO };
