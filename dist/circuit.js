(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  root.TraceCircuit = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const nIn = 4,
    nOut = 2;
  const gates = [];
  const nand = (a, b) => {
    const out = 2 + nIn + gates.length;
    gates.push({ op: 0, a, b, out });
    return out;
  };
  const VALID = 2,
    DEPTH = 3,
    FRESH = 4,
    ACTIVITY = 5;
  const notFresh = nand(FRESH, FRESH);
  const notDepthActivity = nand(DEPTH, ACTIVITY);
  const discoverCore = nand(notFresh, notDepthActivity);
  const depthActivity = nand(notDepthActivity, notDepthActivity);
  const notDiscover = nand(VALID, discoverCore);
  const notShowcase = nand(VALID, depthActivity);
  nand(notDiscover, notDiscover);
  nand(notShowcase, notShowcase);
  function evaluate(bits) {
    if (
      !Array.isArray(bits) ||
      bits.length !== nIn ||
      bits.some((x) => x !== 0 && x !== 1)
    )
      throw new Error("4 binary inputs required");
    const signals = [0, 1, ...bits];
    const trace = [];
    for (const g of gates) {
      const result = signals[g.a] && signals[g.b] ? 0 : 1;
      signals.push(result);
      trace.push({
        gate: g.out,
        a: g.a,
        b: g.b,
        inA: signals[g.a],
        inB: signals[g.b],
        out: result,
      });
    }
    return { discover: signals.at(-2), showcase: signals.at(-1), trace };
  }
  function encode() {
    const bytes = [];
    for (const g of gates) {
      bytes.push(
        0,
        (g.a >>> 16) & 255,
        (g.a >>> 8) & 255,
        g.a & 255,
        (g.b >>> 16) & 255,
        (g.b >>> 8) & 255,
        g.b & 255,
      );
    }
    return "0x" + bytes.map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  function classify(bits) {
    const r = evaluate(bits);
    return bits[0] === 0
      ? "资料待补"
      : r.showcase
        ? "公开进展"
        : r.discover
          ? "新项目发现"
          : "持续建设";
  }
  return Object.freeze({
    nIn,
    nOut,
    gates: Object.freeze(gates.map((g) => Object.freeze(g))),
    encode,
    evaluate,
    classify,
    inputs: ["dataValid", "depthReady", "freshPool", "activityObserved"],
    outputs: ["discover", "showcase"],
  });
});
