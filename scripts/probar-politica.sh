#!/usr/bin/env bash
# Demuestra que las políticas de endoso por lote se aplican (state-based endorsement).
source "$(dirname "$0")/env.sh"
CC=trazabilidad; CH=vino
SUF=$(date +%H%M%S)
LOTE="POL-$SUF"
ORD="-o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile $ORDERER_CA"
puerto() { case $1 in 1) echo 7051;; 2) echo 9051;; 3) echo 11051;; 4) echo 13051;; esac; }
tls() { echo $NET/organizations/peerOrganizations/org$1.example.com/peers/peer0.org$1.example.com/tls/ca.crt; }

inv() {  # inv <org que invoca> "<orgs que endosan>" '<json>'
  setOrg $1
  local P=""
  for o in $2; do P="$P --peerAddresses localhost:$(puerto $o) --tlsRootCertFiles $(tls $o)"; done
  peer chaincode invoke $ORD -C $CH -n $CC $P -c "$3" 2>&1 | tail -2 | cut -c1-200
  sleep 5
}
estado() { setOrg 1; peer chaincode query -C $CH -n $CC -c "{\"function\":\"consultarHistorial\",\"Args\":[\"$LOTE\"]}" | jq -r '.lote.estadoActual'; }
invalidas() { docker logs peer0.org1.example.com --since "$DESDE" 2>&1 | grep -i "marked as invalid" | sed 's/.*Block/Block/' | tail -3; }

DESDE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "Lote de prueba: $LOTE"

echo "== Cosecha (Org1) y certificación (Org1 + Org3)"
inv 1 "1" "{\"function\":\"registrarCosecha\",\"Args\":[\"$LOTE\",\"Vinedo San Javier\",\"Carmenere\",\"2026-03-20\",\"1500\",\"prod-001\"]}"
inv 3 "1 3" "{\"function\":\"registrarCertificacion\",\"Args\":[\"$LOTE\",\"CERT-$SUF\",\"DO Valle del Maule\",\"2026-04-10\",\"cert-001\"]}"
echo "Estado: $(estado)   (esperado: CERTIFICADO)"

echo "== Embotellado endosado SOLO por Org1 (la política del lote exige Org2)"
inv 2 "1" "{\"function\":\"registrarEmbotellado\",\"Args\":[\"$LOTE\",\"1200\",\"2026-08-15\",\"emb-001\"]}"
echo "Estado: $(estado)   (esperado: CERTIFICADO, sin cambio)"
echo "Invalidadas en el peer:"; invalidas

echo "== Embotellado correcto (Org2)"
inv 2 "2" "{\"function\":\"registrarEmbotellado\",\"Args\":[\"$LOTE\",\"1200\",\"2026-08-15\",\"emb-001\"]}"
echo "Estado: $(estado)   (esperado: EMBOTELLADO)"

echo "== Custodia endosada SOLO por Org4 (la política exige Org4 Y Org1)"
inv 4 "4" "{\"function\":\"registrarCambioCustodia\",\"Args\":[\"$LOTE\",\"embotelladora-maule\",\"exportador-andes\",\"2026-09-01\",\"exp-001\"]}"
echo "Estado: $(estado)   (esperado: EMBOTELLADO, sin cambio)"
echo "Invalidadas en el peer:"; invalidas

echo "== Custodia correcta (Org4 + Org1)"
inv 4 "4 1" "{\"function\":\"registrarCambioCustodia\",\"Args\":[\"$LOTE\",\"embotelladora-maule\",\"exportador-andes\",\"2026-09-01\",\"exp-001\"]}"
echo "Estado: $(estado)   (esperado: EN_TRANSITO)"
