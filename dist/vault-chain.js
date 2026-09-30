(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  root.TraceVaultChain = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const deployment = Object.freeze({
    chainId: 196,
    factory: "0x1f09daefa827f02cbb40967cc91b259763760761",
    processor: "0x7761cE17a2e75C6910f1D5a77E6F66CD9Ca1274a",
    approvedCircuitId: 1,
  });
  const endpoints = ["https://xlayerrpc.okx.com", "https://rpc.xlayer.tech"];
  const addressPattern = /^0x[0-9a-fA-F]{40}$/;
  const word = (value) => BigInt(value).toString(16).padStart(64, "0");
  const uint = (hex) => {
    if (!/^0x[0-9a-fA-F]+$/.test(hex || "")) throw new Error("Malformed RPC hex");
    return BigInt(hex);
  };
  const callData = (selector, value) => selector + word(value);
  const parseWords = (hex, count) => {
    if (!new RegExp(`^0x[0-9a-fA-F]{${count * 64}}$`).test(hex || ""))
      throw new Error("Malformed contract response");
    return Array.from({ length: count }, (_, index) =>
      BigInt("0x" + hex.slice(2 + index * 64, 2 + (index + 1) * 64)));
  };
  async function rpc(fetcher, endpoint, method, params) {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "RPC rejected call");
    if (typeof data.result !== "string") throw new Error("RPC result missing");
    return data.result;
  }
  async function inspect(wallet, fetcher, endpoint) {
    if (uint(await rpc(fetcher, endpoint, "eth_chainId", [])) !== 196n)
      throw new Error("RPC is not X Layer");
    const block = await rpc(fetcher, endpoint, "eth_blockNumber", []);
    const blockNumber = uint(block);
    const call = (to, data) => rpc(fetcher, endpoint, "eth_call", [{ to, data }, block]);
    const [registered] = parseWords(await call(
      deployment.factory,
      callData("0x5f5a364f", deployment.processor),
    ), 1);
    const result = {
      checkedAt: new Date().toISOString(),
      blockNumber: blockNumber.toString(),
      endpoint,
      wallet,
      processorRegistered: registered === 1n,
      circuitMatchesDemoPolicy: false,
      circuitOwner: null,
      eligibleCircuit: false,
      reason: "",
    };
    if (!result.processorRegistered) {
      result.reason = "Processor is not registered by the TapeOut factory";
      return result;
    }
    const info = parseWords(await call(
      deployment.processor,
      callData("0x084d60f1", deployment.approvedCircuitId),
    ), 4);
    result.circuitMatchesDemoPolicy =
      info[0] === 4n && info[1] === 2n && info[2] === 0n && info[3] === 8n;
    if (!result.circuitMatchesDemoPolicy) {
      result.reason = "Circuit #1 dimensions do not match the demo allowlist";
      return result;
    }
    const [ownerValue] = parseWords(await call(
      deployment.processor,
      callData("0x6352211e", deployment.approvedCircuitId),
    ), 1);
    result.circuitOwner = "0x" + ownerValue.toString(16).padStart(40, "0");
    result.eligibleCircuit = result.circuitOwner.toLowerCase() === wallet.toLowerCase();
    result.reason = result.eligibleCircuit
      ? "Circuit #1 is factory-registered and owned by this wallet at the checked block"
      : "This wallet does not own Circuit #1 at the checked block";
    return result;
  }
  async function verifyOwner(wallet, fetcher = fetch) {
    if (!addressPattern.test(wallet || "")) throw new Error("Enter a 42-character X Layer wallet address");
    let lastError;
    for (const endpoint of endpoints) {
      try { return await inspect(wallet, fetcher, endpoint); }
      catch (error) { lastError = error; }
    }
    throw new Error(`X Layer read-only verification unavailable: ${lastError?.message || "unknown error"}`);
  }
  return Object.freeze({ deployment, verifyOwner });
});
