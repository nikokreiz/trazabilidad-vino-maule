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

// Tabla compacta para la consola (demo en vivo).
const limpiarMotivo = (m) => (m || '').replace(/^chaincode response \d+, /, '');
function mostrar(filas, titulo) {
  console.log(`\n-- BD externa (app/datos/app.db) · ${titulo}`);
  if (filas.length === 0) {
    console.log('   (sin registros)');
    return;
  }
  const col = [
    ['id', 3, (f) => f.id],
    ['función', 16, (f) => f.funcion.replace('registrar', '')],
    ['lote', 15, (f) => f.id_lote],
    ['invoca', 8, (f) => f.org_invoca.replace('MSP', '')],
    ['endosan', 11, (f) => f.endosantes.replace(/MSP/g, '').replace(/ \+ /g, '+')],
    ['estado', 10, (f) => f.estado],
    ['fase', 10, (f) => f.fase_rechazo || ''],
    ['bloque', 6, (f) => f.bloque ?? ''],
    ['motivo', 48, (f) => limpiarMotivo(f.motivo)],
  ];
  const celda = (v, n) => { const t = String(v); return t.length > n ? `${t.slice(0, n - 1)}…` : t.padEnd(n); };
  console.log('   ' + col.map(([t, n]) => celda(t, n)).join(' │ '));
  console.log('   ' + col.map(([, n]) => '─'.repeat(n)).join('─┼─'));
  for (const f of filas) console.log('   ' + col.map(([, n, g]) => celda(g(f), n)).join(' │ '));
}

module.exports = { registrarEnvio, marcarConfirmada, marcarRechazada, listar, vaciar, mostrar, RUTA };
