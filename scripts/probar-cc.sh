#!/usr/bin/env bash
source "$(dirname "$0")/env.sh"
CC=trazabilidad; CH=vino
ORD="-o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile $ORDERER_CA"
puerto() { case $1 in 1) echo 7051;; 2) echo 9051;; 3) echo 11051;; 4) echo 13051;; esac; }
tls() { echo $NET/organizations/peerOrganizations/org$1.example.com/peers/peer0.org$1.example.com/tls/ca.crt; }

# inv <org que invoca> "<orgs que endosan>" '<json>'
inv() {
  setOrg $1
  local P=""
  for o in $2; do P="$P --peerAddresses localhost:$(puerto $o) --tlsRootCertFiles $(tls $o)"; done
  peer chaincode invoke $ORD -C $CH -n $CC $P -c "$3" 2>&1 | tail -3
  sleep 3
}
qry() {
  setOrg 1
  local out; out=$(peer chaincode query -C $CH -n $CC -c "$1" 2>&1)
  echo "$out" | jq . 2>/dev/null || echo "$out"
}

echo "##### 1. Cosecha (invoca Org1, endosa Org1) -> debe funcionar"
inv 1 "1" '{"function":"registrarCosecha","Args":["LOTE001","Vinedo San Javier","Carmenere","2026-03-20","1500","prod-001"]}'

echo "##### 2. Org2 intenta certificar -> debe fallar: organización no autorizada"
inv 2 "2" '{"function":"registrarCertificacion","Args":["LOTE001","CERT-2026-001","DO Valle del Maule","2026-04-10","emb-001"]}'

echo "##### 3. Certificación (invoca Org3, endosan Org1 y Org3) -> debe funcionar"
inv 3 "1 3" '{"function":"registrarCertificacion","Args":["LOTE001","CERT-2026-001","DO Valle del Maule","2026-04-10","cert-001"]}'

echo "##### 4. Certificar de nuevo -> debe fallar: estado inválido"
inv 3 "1 3" '{"function":"registrarCertificacion","Args":["LOTE001","CERT-2026-002","DO Valle del Maule","2026-04-11","cert-001"]}'

echo "##### 5. Embotellar más de lo cosechado -> debe fallar: volumen"
inv 2 "2" '{"function":"registrarEmbotellado","Args":["LOTE001","9999","2026-08-15","emb-001"]}'

echo "##### 6. Embotellar endosando solo Org1 -> debe quedar INVALIDADA (la política del lote exige Org2)"
inv 2 "1" '{"function":"registrarEmbotellado","Args":["LOTE001","1200","2026-08-15","emb-001"]}'
echo "Estado del lote tras la prueba 6 (debe seguir en CERTIFICADO):"
qry '{"function":"consultarHistorial","Args":["LOTE001"]}' | grep estadoActual

echo "##### 7. Embotellado correcto (invoca y endosa Org2) -> debe funcionar"
inv 2 "2" '{"function":"registrarEmbotellado","Args":["LOTE001","1200","2026-08-15","emb-001"]}'

echo "##### 8. Cambio de custodia (invoca Org4, endosan Org4 y Org1) -> debe funcionar"
inv 4 "4 1" '{"function":"registrarCambioCustodia","Args":["LOTE001","embotelladora-maule","exportador-andes","2026-09-01","exp-001"]}'

echo "##### 9. Historial completo"
qry '{"function":"consultarHistorial","Args":["LOTE001"]}'

echo "##### 10. Auditoría de versiones (inmutabilidad)"
qry '{"function":"auditarLote","Args":["LOTE001"]}'
