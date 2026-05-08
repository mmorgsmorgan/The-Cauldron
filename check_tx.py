import json, urllib.request

data = json.dumps({
    "jsonrpc": "2.0",
    "method": "eth_getTransactionReceipt",
    "params": ["0x20fb90995350bdf12b239e7222473d660c1f02245e52d7efdf2ac80be578940c"],
    "id": 1
}).encode()

req = urllib.request.Request(
    "https://rpc.ritualfoundation.org",
    data=data,
    headers={"Content-Type": "application/json"}
)

resp = json.loads(urllib.request.urlopen(req).read())
result = resp["result"]
print(f"Contract: {result['contractAddress']}")
print(f"Status: {result['status']}")
print(f"Block: {int(result['blockNumber'], 16)}")
