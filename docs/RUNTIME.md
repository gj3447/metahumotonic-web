# Project runtime

Node 24.21.0 is pinned in .node-version and .nvmrc. On dev-01 it is installed at
/opt/metahumotonic/toolchains/node-v24.21.0-linux-x64 after official SHA-256 verification.
Use ./scripts/with-node.sh npm ci, then ./scripts/with-node.sh npm run test:release
and ./scripts/with-node.sh npm run build. Other hosts may use nvm install or
MHB_NODE_HOME. The launcher requires the exact pinned version and does not change
system-wide Node, another project, a connector runtime, or running services.
A direct npm invocation on Node below 22.12 is rejected by preinstall.

The administrator default Node 20 and the owner's login-shell Node 24 were
different paths. A successful login-shell build does not validate a service's PATH.
CI and the standalone Docker builder must use the same pinned release.
