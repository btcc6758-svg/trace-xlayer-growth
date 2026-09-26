const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const circuit = require("./dist/circuit.js");
const bytes = Buffer.from(circuit.encode().slice(2), "hex");
const truthTable = [];
for (let value = 0; value < 16; value++) {
  const inputs = [0, 1, 2, 3].map((i) => (value >> i) & 1);
  const { discover, showcase } = circuit.evaluate(inputs);
  truthTable.push({ inputs, outputs: [discover, showcase] });
}
const artifact = {
  format: "TapeOut EVM netlist",
  network: "X Layer",
  chainId: 196,
  inputs: circuit.inputs,
  outputs: circuit.outputs,
  nIn: circuit.nIn,
  nOut: circuit.nOut,
  nandCount: circuit.gates.length,
  byteLength: bytes.length,
  sha256: "0x" + createHash("sha256").update(bytes).digest("hex"),
  netlist: circuit.encode(),
  truthTable,
};
const target = path.join(__dirname, "dist", "netlist.json");
fs.writeFileSync(target, JSON.stringify(artifact, null, 2) + "\n", "utf8");
console.log(target);
