#!/bin/bash
# Verify Ritual Chain connection and deployed contracts

echo "=== Chain ID ==="
curl -s -X POST https://rpc.ritualfoundation.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

echo ""
echo "=== Factory bytecode ==="
curl -s -X POST https://rpc.ritualfoundation.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f","latest"],"id":2}' | head -c 120

echo ""
echo "=== Marketplace bytecode ==="
curl -s -X POST https://rpc.ritualfoundation.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B","latest"],"id":3}' | head -c 120

echo ""
echo "=== Implementation bytecode ==="
curl -s -X POST https://rpc.ritualfoundation.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0xBCea72054CEd720c797501fdA3Eb07866C12d67b","latest"],"id":4}' | head -c 120

echo ""
echo "=== Done ==="
