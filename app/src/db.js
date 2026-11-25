'use strict';
// Base de datos externa (off-chain) de la aplicación cliente.
// Registra cada transacción enviada a la red y el resultado que devuelve Fabric.
const path = require('node:path');
const Database = require('better-sqlite3');

const RUTA = process.env.APP_DB || path.join(__dirname, '..', 'datos', 'app.db');

let db;
function abrir() {
  if (db) return db;
  require('node:fs').mkdirSync(path.dirname(RUTA), { recursive: true });
  db = new Database(RUTA);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS transacciones (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      creada_en     TEXT NOT NULL,
      funcion       TEXT NOT NULL,          -- función del smart contract que la procesa
      id_lote       TEXT,
      org_invoca    TEXT NOT NULL,
      endosantes    TEXT NOT NULL,
      estado        TEXT NOT NULL CHECK (estado IN ('PENDIENTE','CONFIRMADA','RECHAZADA')),
      fase_rechazo  TEXT CHECK (fase_rechazo IN ('ENDOSO','VALIDACION')),
      tx_id         TEXT,
      bloque        INTEGER,
      motivo        TEXT,
      respondida_en TEXT
    )`);
  return db;
}

const ahora = () => new Date().toISOString();

// Antes del envío: la transacción queda PENDIENTE.
function registrarEnvio({ funcion, idLote, orgInvoca, endosantes, txId }) {
  const r = abrir().prepare(`
    INSERT INTO transacciones (creada_en, funcion, id_lote, org_invoca, endosantes, estado, tx_id)
    VALUES (?, ?, ?, ?, ?, 'PENDIENTE', ?)`)
    .run(ahora(), funcion, idLote, orgInvoca, endosantes.join(' + '), txId);
  return r.lastInsertRowid;
}

function marcarConfirmada(id, { txId, bloque }) {
  abrir().prepare(`
    UPDATE transacciones SET estado='CONFIRMADA', tx_id=?, bloque=?, respondida_en=? WHERE id=?`)
    .run(txId, bloque, ahora(), id);
}

function marcarRechazada(id, { fase, motivo, txId = null, bloque = null }) {
  abrir().prepare(`
    UPDATE transacciones SET estado='RECHAZADA', fase_rechazo=?, motivo=?, tx_id=COALESCE(?, tx_id),
           bloque=?, respondida_en=? WHERE id=?`)
    .run(fase, motivo, txId, bloque, ahora(), id);
}

function listar({ idLote, limite = 50 } = {}) {
  const d = abrir();
  return idLote
    ? d.prepare('SELECT * FROM transacciones WHERE id_lote=? ORDER BY id').all(idLote)
    : d.prepare('SELECT * FROM transacciones ORDER BY id DESC LIMIT ?').all(limite).reverse();
}

function vaciar() {
  abrir().exec("DELETE FROM transacciones; DELETE FROM sqlite_sequence WHERE name='transacciones';");
}

// Tabla legible para la consola (demo en vivo).
function mostrar(filas, titulo) {
  console.log(`\n-- BD externa (${RUTA}) · ${titulo}`);
  if (filas.length === 0) {
    console.log('   (sin registros)');
    return;
  }
  console.table(filas.map((f) => ({
    id: f.id,
    funcion: f.funcion,
    lote: f.id_lote,
    invoca: f.org_invoca,
    endosan: f.endosantes,
    estado: f.estado,
    fase: f.fase_rechazo || '',
    bloque: f.bloque ?? '',
    tx: f.tx_id ? `${f.tx_id.slice(0, 10)}…` : '',
    motivo: f.motivo ? f.motivo.slice(0, 60) : '',
  })));
}

module.exports = { registrarEnvio, marcarConfirmada, marcarRechazada, listar, vaciar, mostrar, RUTA };
