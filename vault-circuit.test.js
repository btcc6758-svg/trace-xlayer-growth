const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const circuit = require("./dist/vault-circuit.js");
const artifact = JSON.parse(fs.readFileSync("dist/vault-netlist.json", "utf8"));

assert.equal(circuit.gates.length, 8);
assert.equal(circuit.encode(), artifact.netlist);
assert.equal(Buffer.from(circuit.encode().slice(2), "hex").length, 56);
assert.equal(
  "0x" + createHash("sha256").update(Buffer.from(circuit.encode().slice(2), "hex")).digest("hex"),
  artifact.sha256,
);
assert.deepEqual(circuit.truthTable(), artifact.truthTable);
for (let index = 0; index < 16; index++) {
  const bits = [0, 1, 2, 3].map((bit) => (index >> bit) & 1);
  const actual = circuit.evaluate(bits);
  const candidate = bits[0] && bits[1] && bits[2] ? 1 : 0;
  assert.equal(actual.canClaim, candidate && bits[3] ? 1 : 0, `canClaim row ${index}`);
  assert.equal(actual.waitBudget, candidate && !bits[3] ? 1 : 0, `waitBudget row ${index}`);
  assert.equal(actual.canClaim + actual.waitBudget <= 1, true);
}
assert.throws(() => circuit.evaluate([1, 1, 1, 2]), /binary/);
console.log("Vault candidate: 16 rows, output ordering, NAND netlist and digest passed.");
