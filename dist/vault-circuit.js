(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  root.TraceVaultCircuit = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Candidate design only. No Circuit #2 has been taped out on mainnet.
  const inputs = ["eligibleCircuit", "windowOpen", "claimUnused", "budgetReady"];
  const outputs = ["canClaim", "waitBudget"];
  const gates = [];
  const nand = (a, b) => {
    const out = 2 + inputs.length + gates.length;
    gates.push({ op: 0, a, b, out });
    return out;
  };

  // candidate = eligibleCircuit AND windowOpen AND claimUnused.
  const notFirstPair = nand(2, 3);
  const firstPair = nand(notFirstPair, notFirstPair);
  const notCandidate = nand(firstPair, 4);
  const candidate = nand(notCandidate, notCandidate);
  const notCanClaim = nand(candidate, 5);
  const notWaitBudget = nand(candidate, notCanClaim);
  // TapeOut reads outputs from the final two signals, in this order.
  nand(notCanClaim, notCanClaim);
  nand(notWaitBudget, notWaitBudget);

  function evaluate(bits) {
    if (
      !Array.isArray(bits) ||
      bits.length !== inputs.length ||
      bits.some((value) => value !== 0 && value !== 1)
    ) throw new Error("Four binary inputs required");
    const signals = [0, 1, ...bits];
    const trace = [];
    for (const gate of gates) {
      const output = signals[gate.a] && signals[gate.b] ? 0 : 1;
      signals.push(output);
      trace.push({ gate: gate.out, a: gate.a, b: gate.b, out: output });
    }
    return { canClaim: signals.at(-2), waitBudget: signals.at(-1), trace };
  }

  function encode() {
    const bytes = [];
    for (const gate of gates) {
      bytes.push(0, (gate.a >>> 16) & 255, (gate.a >>> 8) & 255, gate.a & 255,
        (gate.b >>> 16) & 255, (gate.b >>> 8) & 255, gate.b & 255);
    }
    return "0x" + bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function truthTable() {
    return Array.from({ length: 16 }, (_, index) => {
      const bits = inputs.map((_, bit) => (index >> bit) & 1);
      const result = evaluate(bits);
      return { inputs: bits, outputs: [result.canClaim, result.waitBudget] };
    });
  }

  return Object.freeze({
    inputs: Object.freeze(inputs),
    outputs: Object.freeze(outputs),
    gates: Object.freeze(gates.map((gate) => Object.freeze(gate))),
    evaluate, encode, truthTable,
  });
});
