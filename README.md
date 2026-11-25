# Trazabilidad blockchain de vino con Denominación de Origen (Valle del Maule)

Proyecto del ramo de Blockchain, UCM. Red de consorcio Hyperledger Fabric 2.5 (4 organizaciones, canal `vino`,
orderer Raft, CouchDB) para prevenir el fraude de denominación de origen. Organización ficticia basada en información pública.

| Org | Rol | Peer |
|-----|-----|------|
| Org1MSP | Cooperativa / Productor | peer0.org1 :7051 |
| Org2MSP | Embotelladora | peer0.org2 :9051 |
| Org3MSP | Certificadora | peer0.org3 :11051 |
| Org4MSP | Exportador / Distribuidor | peer0.org4 :13051 |

## Estructura
- `chaincode/`: chaincode `TrazabilidadVino` (JavaScript, fabric-contract-api).
- `app/`: aplicación cliente (Node.js + fabric-gateway), BD externa SQLite y gateway QR de solo lectura.
- `scripts/`: red, despliegue del chaincode, pruebas y parches de Org4 para `test-network`.
- `docs/`: evidencias de ejecución (`./scripts/evidencias.sh <1-7>` las genera para las capturas).

## Requisitos
Linux o Windows con WSL2 (Ubuntu), Docker, Node.js 20, `jq` y Fabric 2.5:

```bash
cd ~
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh && ./install-fabric.sh --fabric-version 2.5.16 docker samples binary
```

Por defecto los scripts usan `~/fabric-samples`. Si está en otra ruta: `export FABRIC_SAMPLES=/ruta/a/fabric-samples`.

## Puesta en marcha
```bash
./scripts/instalar-parches.sh      # copia addOrg4 y los scripts parchados a test-network (una vez)
./scripts/reiniciar-red.sh         # red de 4 orgs + canal vino, desde cero
./scripts/desplegar-cc.sh 1.0 1    # empaquetar, instalar, aprobar (4 orgs) y commit

cd app && npm install
npm run demo                       # flujo completo de un lote + rechazos, con la BD antes y después
npm run bd                         # ver la BD externa (npm run bd -- <idLote> | npm run bd -- --vaciar)
npm run api                        # gateway QR en http://localhost:3000/verificar/<idLote>
```

Pruebas por línea de comandos: `./scripts/probar-cc.sh` y `./scripts/probar-politica.sh`.

## Base de datos externa
La aplicación guarda cada transacción en `app/datos/app.db` (SQLite, tabla `transacciones`): queda en `PENDIENTE`
al enviarse y pasa a `CONFIRMADA` (con bloque y txId) o `RECHAZADA`, indicando la fase (`ENDOSO` si la rechazó el
chaincode en la simulación, `VALIDACION` si los peers la invalidaron en el bloque) y el motivo.
