const fs = require("node:fs");
const { createHash } = require("node:crypto");
const circuit = require("./dist/vault-circuit.js");
const netlist = circuit.encode();
const bytes = Buffer.from(netlist.slice(2), "hex");
const artifact = {
  status: "design only; not taped out on mainnet",
  format: "TapeOut EVM netlist",
  network: "X Layer",
  chainId: 196,
  inputs: circuit.inputs,
  outputs: circuit.outputs,
  nIn: 4,
  nOut: 2,
  nandCount: circuit.gates.length,
  byteLength: bytes.length,
  sha256: "0x" + createHash("sha256").update(bytes).digest("hex"),
  netlist,
  truthTable: circuit.truthTable(),
};
fs.writeFileSync("dist/vault-netlist.json", JSON.stringify(artifact, null, 2) + "\n");
console.log(`Vault candidate: ${circuit.gates.length} NAND, ${bytes.length} bytes, ${artifact.sha256}`);
