const assert = require("node:assert/strict");
const chain = require("./dist/vault-chain.js");
const wallet = "0x1d207352dd708498cada1524eb4b36b5fa178886";
const word = (value) => BigInt(value).toString(16).padStart(64, "0");

function mockRpc({ registered = 1n, dimensions = [4n, 2n, 0n, 8n], owner = wallet, fail = false } = {}) {
  const requests = [];
  async function fetcher(_endpoint, options) {
    if (fail) throw new Error("offline");
    const payload = JSON.parse(options.body);
    requests.push(payload);
    if (payload.method === "eth_chainId") return { ok: true, json: async () => ({ result: "0xc4" }) };
    if (payload.method === "eth_blockNumber") return { ok: true, json: async () => ({ result: "0x2a" }) };
    assert.equal(payload.method, "eth_call");
    assert.equal(payload.params[1], "0x2a", "all facts use the same block");
    const data = payload.params[0].data;
    let result;
    if (data.startsWith("0x5f5a364f")) result = "0x" + word(registered);
    else if (data.startsWith("0x084d60f1")) result = "0x" + dimensions.map(word).join("");
    else if (data.startsWith("0x6352211e")) result = "0x" + word(owner);
    else throw new Error(`Unexpected selector: ${data.slice(0, 10)}`);
    return { ok: true, json: async () => ({ result }) };
  }
  return { fetcher, requests };
}

(async () => {
  const approved = mockRpc();
  const real = await chain.verifyOwner(wallet, approved.fetcher);
  assert.equal(real.eligibleCircuit, true);
  assert.equal(real.blockNumber, "42");
  assert.equal(real.circuitOwner.toLowerCase(), wallet);
  assert.equal(approved.requests.length, 5);
  assert.equal((await chain.verifyOwner("0x0000000000000000000000000000000000000001", mockRpc().fetcher)).eligibleCircuit, false);
  assert.equal((await chain.verifyOwner(wallet, mockRpc({ registered: 0n }).fetcher)).eligibleCircuit, false);
  assert.equal((await chain.verifyOwner(wallet, mockRpc({ dimensions: [4n, 2n, 0n, 1n] }).fetcher)).eligibleCircuit, false);
  await assert.rejects(chain.verifyOwner(wallet, mockRpc({ fail: true }).fetcher), /unavailable/);
  await assert.rejects(chain.verifyOwner("bad", mockRpc().fetcher), /42-character/);
  console.log("Vault proof: pinned-block eligibility, rejection and RPC failure passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
