#!/usr/bin/env bash
# Copia a fabric-samples/test-network los parches que agregan la cuarta organización (Org4).
set -euo pipefail
source "$(dirname "$0")/env.sh"
P=$REPO_DIR/scripts/fabric-patches
[ -d "$NET" ] || { echo "No existe $NET. Instale Fabric: curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh && ./install-fabric.sh docker samples binary"; exit 1; }
cp -r "$P/addOrg4" "$NET/"
mkdir -p "$NET/scripts/org4-scripts"
cp "$P/org4-scripts/"*.sh "$NET/scripts/org4-scripts/"
cp "$P/envVar.sh" "$P/setAnchorPeer.sh" "$NET/scripts/"
chmod +x "$NET/addOrg4/addOrg4.sh" "$NET/addOrg4/ccp-generate.sh" "$NET/addOrg4/fabric-ca/registerEnroll.sh" "$NET/scripts/org4-scripts/"*.sh
echo "Parches de Org4 copiados en $NET"
