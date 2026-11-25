'use strict';
// Muestra la BD externa. Uso: npm run bd [-- idLote]   |   npm run bd -- --vaciar
const db = require('./db');

const arg = process.argv[2];
if (arg === '--vaciar') {
  db.vaciar();
  console.log('BD externa vaciada.');
} else {
  db.mostrar(db.listar({ idLote: arg }), arg ? `lote ${arg}` : 'últimas transacciones');
}
