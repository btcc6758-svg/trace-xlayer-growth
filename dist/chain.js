(function (root) {
  const deployment = { chainId: 196, processor: null, circuitId: null };
  const rpc = "https://xlayerrpc.okx.com";
  const word = (n) => BigInt(n).toString(16).padStart(64, "0");
  const inputsToByte = (bits) => bits.reduce((n, bit, i) => n | (bit << i), 0);
  function calldata(circuitId, bits) {
    const byte = inputsToByte(bits).toString(16).padStart(2, "0");
    return (
      "0x934d06ea" + word(circuitId) + word(64) + word(1) + byte.padEnd(64, "0")
    );
  }
  function decodeBytes(result) {
    if (!/^0x[0-9a-fA-F]+$/.test(result))
      throw new Error("Malformed RPC result");
    const hex = result.slice(2);
    if (hex.length < 128) throw new Error("Short ABI response");
    const offset = Number(BigInt("0x" + hex.slice(0, 64))) * 2;
    if (offset + 64 > hex.length) throw new Error("Invalid ABI offset");
    const length = Number(BigInt("0x" + hex.slice(offset, offset + 64)));
    if (length < 1 || length > 1024 || offset + 64 + length * 2 > hex.length)
      throw new Error("Invalid ABI length");
    return hex.slice(offset + 64, offset + 64 + length * 2);
  }
  async function evaluate(bits) {
    if (!deployment.processor || deployment.circuitId === null) return null;
    if (!/^0x[0-9a-fA-F]{40}$/.test(deployment.processor))
      throw new Error("Invalid processor address");
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: deployment.processor,
          data: calldata(deployment.circuitId, bits),
        },
        "latest",
      ],
    };
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("RPC HTTP " + response.status);
    const json = await response.json();
    if (json.error) throw new Error(json.error.message || "RPC rejected call");
    const output = decodeBytes(json.result);
    const value = parseInt(output.slice(0, 2), 16);
    return {
      discover: value & 1,
      showcase: (value >> 1) & 1,
      raw: "0x" + output,
    };
  }
  root.TraceChain = Object.freeze({
    deployment,
    evaluate,
    calldata,
    decodeBytes,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
