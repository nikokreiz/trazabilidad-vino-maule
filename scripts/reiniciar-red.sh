#!/usr/bin/env bash
# Reinicio limpio de la red de 4 orgs (canal "vino").
set -u
source "$(dirname "$0")/env.sh"
cd "$NET" || { echo "No existe $NET (defina FABRIC_SAMPLES)"; exit 1; }
[ -d addOrg4 ] || { echo "Faltan los parches de Org4: ejecute scripts/instalar-parches.sh"; exit 1; }

echo ">> Bajando la red y limpiando restos..."
./network.sh down
# Solo contenedores de la red Fabric (no toca otros contenedores del equipo)
docker rm -f $(docker ps -aq --filter "name=example.com" --filter "name=couchdb" --filter "name=ca_" --filter "name=dev-peer") 2>/dev/null
docker volume rm $(docker volume ls -q | grep -E "peer0\.org|orderer\.example\.com") 2>/dev/null
sudo rm -rf addOrg4/fabric-ca/org4/msp addOrg4/fabric-ca/org4/tls-cert.pem \
            addOrg4/fabric-ca/org4/ca-cert.pem addOrg4/fabric-ca/org4/IssuerPublicKey \
            addOrg4/fabric-ca/org4/IssuerRevocationPublicKey addOrg4/fabric-ca/org4/fabric-ca-server.db

echo ">> Levantando Org1, Org2 y el canal vino..."
./network.sh up createChannel -c vino -ca -s couchdb || { echo "FALLO: red base"; exit 1; }

echo ">> Agregando Org3..."
(cd addOrg3 && ./addOrg3.sh up -c vino -ca -s couchdb) || { echo "FALLO: Org3"; exit 1; }

echo ">> Agregando Org4..."
(cd addOrg4 && ./addOrg4.sh up -c vino -ca -s couchdb) || { echo "FALLO: Org4"; exit 1; }

echo ">> Red lista:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "peer0|orderer|couchdb"
