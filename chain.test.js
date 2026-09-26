const assert = require("node:assert/strict");
require("./dist/chain.js");
const chain = global.TraceChain;
const word = (n) => BigInt(n).toString(16).padStart(64, "0");
for (let value = 0; value < 16; value++) {
  const bits = [0, 1, 2, 3].map((i) => (value >> i) & 1);
  const encoded = chain.calldata(7, bits);
  assert.equal(
    encoded,
    "0x934d06ea" +
      word(7) +
      word(64) +
      word(1) +
      value.toString(16).padStart(2, "0").padEnd(64, "0"),
  );
}
for (let value = 0; value < 4; value++) {
  const response =
    "0x" +
    word(32) +
    word(1) +
    value.toString(16).padStart(2, "0").padEnd(64, "0");
  assert.equal(
    chain.decodeBytes(response),
    value.toString(16).padStart(2, "0"),
  );
}
console.log("16 ABI input encodings and 4 ABI output decodings passed.");
