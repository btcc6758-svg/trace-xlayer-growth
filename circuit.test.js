const assert = require("node:assert/strict");
const circuit = require("./dist/circuit.js");
assert.equal(circuit.nIn, 4);
assert.equal(circuit.nOut, 2);
assert.equal(circuit.gates.length, 8);
assert.equal((circuit.encode().length - 2) / 2, 56);
for (let valid = 0; valid < 2; valid++)
  for (let depth = 0; depth < 2; depth++)
    for (let fresh = 0; fresh < 2; fresh++)
      for (let activity = 0; activity < 2; activity++) {
        const actual = circuit.evaluate([valid, depth, fresh, activity]);
        const expectedDiscover =
          valid && (fresh || (depth && activity)) ? 1 : 0;
        const expectedShowcase = valid && depth && activity ? 1 : 0;
        assert.equal(
          actual.discover,
          expectedDiscover,
          `${valid}${depth}${fresh}${activity} discover`,
        );
        assert.equal(
          actual.showcase,
          expectedShowcase,
          `${valid}${depth}${fresh}${activity} showcase`,
        );
      }
console.log(
  "16 input combinations passed; 8 NAND gates; 56-byte TapeOut netlist.",
);
