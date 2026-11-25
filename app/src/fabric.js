'use strict';
// Conexión al gateway de Fabric con la identidad de una organización.
const grpc = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const NET = process.env.FABRIC_NET || path.join(process.env.FABRIC_SAMPLES || path.join(os.homedir(), 'fabric-samples'), 'test-network');
const CANAL = process.env.CANAL || 'vino';
const CHAINCODE = process.env.CHAINCODE || 'trazabilidad';

const ORGS = {
  1: { msp: 'Org1MSP', puerto: 7051 },
  2: { msp: 'Org2MSP', puerto: 9051 },
  3: { msp: 'Org3MSP', puerto: 11051 },
  4: { msp: 'Org4MSP', puerto: 13051 },
};

function rutas(n, usuario) {
  const dominio = `org${n}.example.com`;
  const base = path.join(NET, 'organizations', 'peerOrganizations', dominio);
  const msp = path.join(base, 'users', `${usuario}@${dominio}`, 'msp');
  return {
    tlsCert: path.join(base, 'peers', `peer0.${dominio}`, 'tls', 'ca.crt'),
    certDir: path.join(msp, 'signcerts'),
    keyDir: path.join(msp, 'keystore'),
    host: `peer0.${dominio}`,
  };
}

function primerArchivo(dir) {
  const archivos = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
  if (archivos.length === 0) throw new Error(`No hay archivos en ${dir}`);
  return path.join(dir, archivos[0]);
}

// Devuelve { contract, close }. "usuario" es Admin o User1.
function conectar(n, usuario = 'Admin') {
  const org = ORGS[n];
  if (!org) throw new Error(`Organización desconocida: ${n}`);
  const r = rutas(n, usuario);

  const client = new grpc.Client(
    `localhost:${org.puerto}`,
    grpc.credentials.createSsl(fs.readFileSync(r.tlsCert)),
    { 'grpc.ssl_target_name_override': r.host },
  );

  const gateway = connect({
    client,
    identity: { mspId: org.msp, credentials: fs.readFileSync(primerArchivo(r.certDir)) },
    signer: signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(primerArchivo(r.keyDir)))),
    hash: hash.sha256,
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15000 }),
    submitOptions: () => ({ deadline: Date.now() + 5000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });

  const contract = gateway.getNetwork(CANAL).getContract(CHAINCODE);
  return {
    contract,
    close() { gateway.close(); client.close(); },
  };
}

module.exports = { conectar, ORGS };
