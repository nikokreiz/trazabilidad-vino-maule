#!/usr/bin/env bash
# Despliega TrazabilidadVino con las 4 orgs.
# Uso: ./desplegar-cc.sh [version] [secuencia]   (primera vez: 1.0 1; actualizar: 1.1 2, 1.2 3...)
set -euo pipefail
source "$(dirname "$0")/env.sh"

VERSION=${1:-1.0}
SEQ=${2:-1}
CC_NAME=trazabilidad
CC_PATH=$REPO_DIR/chaincode
CH=vino
POLICY="OR('Org1MSP.peer','Org2MSP.peer','Org3MSP.peer','Org4MSP.peer')"
ORD="-o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile $ORDERER_CA"
PKG=/tmp/${CC_NAME}_${VERSION}.tar.gz

cd "$NET"

echo ">> 1/5 Empaquetando..."
setOrg 1
peer lifecycle chaincode package "$PKG" --path "$CC_PATH" --lang node --label ${CC_NAME}_${VERSION}
CC_ID=$(peer lifecycle chaincode calculatepackageid "$PKG")
echo "Package ID: $CC_ID"

echo ">> 2/5 Instalando en los 4 peers (la primera vez tarda: cada peer construye la imagen)..."
for o in 1 2 3 4; do setOrg $o; peer lifecycle chaincode install "$PKG"; done

echo ">> 3/5 Aprobando por las 4 orgs..."
for o in 1 2 3 4; do
  setOrg $o
  peer lifecycle chaincode approveformyorg $ORD --channelID $CH --name $CC_NAME --version $VERSION \
    --package-id "$CC_ID" --sequence $SEQ --signature-policy "$POLICY"
done

echo ">> 4/5 Estado de aprobaciones:"
setOrg 1
peer lifecycle chaincode checkcommitreadiness --channelID $CH --name $CC_NAME --version $VERSION \
  --sequence $SEQ --signature-policy "$POLICY" --output json

echo ">> 5/5 Commit..."
PEERS=""
for o in 1 2 3 4; do
  case $o in 1) P=7051;; 2) P=9051;; 3) P=11051;; 4) P=13051;; esac
  PEERS="$PEERS --peerAddresses localhost:$P --tlsRootCertFiles $NET/organizations/peerOrganizations/org$o.example.com/peers/peer0.org$o.example.com/tls/ca.crt"
done
peer lifecycle chaincode commit $ORD --channelID $CH --name $CC_NAME --version $VERSION \
  --sequence $SEQ --signature-policy "$POLICY" $PEERS
sleep 3
peer lifecycle chaincode querycommitted --channelID $CH --name $CC_NAME
echo ">> Listo."
