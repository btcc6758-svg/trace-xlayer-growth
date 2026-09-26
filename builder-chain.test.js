const assert = require("node:assert/strict");
const chain = require("./dist/builder-chain.js");

const FACTORY = chain.FACTORY;
const CPU = "0x839bdd6fa7a66416a609a735e11de5411b98574e";
const word = (value) => "0x" + BigInt(value).toString(16).padStart(64, "0");
assert.equal(chain.isAddress(CPU), true);
assert.equal(chain.isAddress("0x123"), false);
assert.equal(
  chain.callIsCPU(CPU),
  "0x5f5a364f" + CPU.slice(2).padStart(64, "0"),
);
assert.equal(chain.uint(word(3)), 3n);

const originalFetch = global.fetch;
const calls = [];
global.fetch = async (endpoint, options) => {
  const request = JSON.parse(options.body);
  calls.push({ endpoint, request });
  let result;
  if (request.method === "eth_chainId") result = "0xc4";
  else if (request.method === "eth_getCode") result = "0x6000";
  else if (request.params[0].to.toLowerCase() === FACTORY) result = word(1);
  else result = word(3);
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }));
};
(async () => {
  try {
    const result = await chain.verify(CPU, CPU);
    assert.equal(result.chainId, 196);
    assert.equal(result.contract.status, "code_present");
    assert.equal(result.processor.status, "registered");
    assert.equal(result.processor.circuitCount, "3");
    assert.deepEqual(
      calls.map((call) => call.request.method),
      ["eth_chainId", "eth_getCode", "eth_call", "eth_call"],
    );
    assert.equal(calls[2].request.params[0].data, chain.callIsCPU(CPU));
    assert.equal(calls[3].request.params[0].data, chain.SELECTORS.nextId);
    global.fetch = async (_endpoint, options) => {
      const request = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result:
            request.method === "eth_chainId"
              ? "0xc4"
              : request.method === "eth_getCode"
                ? "0x"
                : word(0),
        }),
      );
    };
    const unregistered = await chain.verify(CPU, CPU);
    assert.equal(unregistered.contract.status, "no_code");
    assert.equal(unregistered.processor.status, "not_registered");
    assert.equal(unregistered.processor.circuitCount, null);
    console.log("Builder chain verification and missing-state checks passed.");
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
