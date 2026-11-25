#!/usr/bin/env bash
# Muestra, sección por sección, la evidencia de configuración de la red para las capturas del informe.
# Uso: ./scripts/evidencias.sh <1-7>   (sin argumento: todas). Cada salida se guarda en docs/evidencias/.
set -u
source "$(dirname "$0")/env.sh"
CH=vino; CC=trazabilidad
OUT=$REPO_DIR/docs/evidencias; mkdir -p "$OUT"
ORD_TLS=$NET/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls
titulo() { echo; echo "================ $* ================"; }

s1() { titulo "1. Organizaciones y autoridades certificadoras (Fabric CA)"
  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}" | grep -E "NAMES|ca_"
  for o in 1 2 3 4; do
    echo; echo "-- Org$o: certificado del Admin emitido por su CA"
    openssl x509 -noout -subject -issuer -in "$(ls $NET/organizations/peerOrganizations/org$o.example.com/users/Admin@org$o.example.com/msp/signcerts/*)"
  done; }

s2() { titulo "2. Peers (endosantes y validadores) y CouchDB"
  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}" | grep -E "NAMES|peer0|couchdb"
  echo; echo "Todos los peers son validadores (committing). Endosan según la política del lote:"
  echo "  Cosecha: Org1 | Certificación: Org1 Y Org3 | Embotellado: Org2 | Custodia: Org4 Y Org1"; }

s3() { titulo "3. Servicio de ordenamiento Raft"
  echo "-- configtx.yaml (consenso):"
  sed -n '/^Orderer: &OrdererDefaults/,/BatchTimeout/p' "$NET/configtx/configtx.yaml" | grep -vE "^\s*#|^\s*$"
  echo; echo "-- Canales del orderer (osnadmin):"
  osnadmin channel list -o localhost:7053 --ca-file "$ORDERER_CA" --client-cert "$ORD_TLS/server.crt" --client-key "$ORD_TLS/server.key"
  osnadmin channel list --channelID $CH -o localhost:7053 --ca-file "$ORDERER_CA" --client-cert "$ORD_TLS/server.crt" --client-key "$ORD_TLS/server.key"
  echo; echo "-- Elección de líder Raft (log del orderer):"
  docker logs orderer.example.com 2>&1 | grep -iE "became leader|raft.node.*elected leader|Leader" | grep -i "channel=$CH\|$CH" | tail -3; }

s4() { titulo "4. Canal \"$CH\" y unión de los peers"
  for o in 1 2 3 4; do setOrg $o; echo; echo "-- peer0.org$o:"; peer channel list 2>/dev/null; peer channel getinfo -c $CH 2>/dev/null; done; }

s5() { titulo "5. Ciclo de vida del chaincode: instalación y aprobaciones"
  for o in 1 2 3 4; do setOrg $o; echo; echo "-- queryinstalled en peer0.org$o:"; peer lifecycle chaincode queryinstalled 2>/dev/null; done
  setOrg 1; echo; echo "-- Aprobaciones (querycommitted):"
  peer lifecycle chaincode querycommitted --channelID $CH --name $CC 2>/dev/null; }

s6() { titulo "6. Política de endoso"
  setOrg 1
  peer lifecycle chaincode querycommitted --channelID $CH --name $CC --output json 2>/dev/null | jq '{name, version, sequence, endorsement_plugin, validation_plugin, approvals}'
  echo "Política del chaincode: OR('Org1MSP.peer','Org2MSP.peer','Org3MSP.peer','Org4MSP.peer')"
  echo "Más política por lote (state-based endorsement) fijada por el chaincode en cada transición."; }

s7() { titulo "7. Transacciones invalidadas por la red (log del peer)"
  docker logs peer0.org1.example.com 2>&1 | grep -i "marked as invalid" | tail -6; }

secciones=${1:-1 2 3 4 5 6 7}
for s in $secciones; do
  s$s 2>&1 | tee "$OUT/seccion-$s.txt"
done
