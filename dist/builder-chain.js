(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  root.BuilderChain = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FACTORY = "0x1f09daefa827f02cbb40967cc91b259763760761";
  const RPCS = [
    "https://xlayerrpc.okx.com",
    "https://rpc.xlayer.tech",
    "https://xlayer.drpc.org",
  ];
  const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
  const SELECTORS = Object.freeze({
    isCPU: "0x5f5a364f",
    nextId: "0x61b8ce8c",
  });
  const isAddress = (value) => ADDRESS.test(value || "");
  const callIsCPU = (address) => {
    if (!isAddress(address)) throw new Error("Processor 地址格式错误");
    return SELECTORS.isCPU + address.slice(2).toLowerCase().padStart(64, "0");
  };
  const uint = (value) => {
    if (!/^0x[0-9a-fA-F]+$/.test(value || ""))
      throw new Error("链上响应格式错误");
    return BigInt(value);
  };
  async function rpc(method, params) {
    let lastError;
    for (const endpoint of RPCS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
        const body = await response.json();
        if (body.error) throw new Error(body.error.message || "RPC 拒绝查询");
        if (typeof body.result !== "string")
          throw new Error("RPC 响应缺少结果");
        return { value: body.result, endpoint };
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error(
      `X Layer RPC 暂不可用：${lastError?.message || "未知错误"}`,
    );
  }
  async function verify(contractAddress, processorAddress) {
    if (!isAddress(contractAddress))
      throw new Error("X Layer 合约地址格式错误");
    if (processorAddress && !isAddress(processorAddress))
      throw new Error("Processor 地址格式错误");
    const chain = await rpc("eth_chainId", []);
    if (uint(chain.value) !== 196n) throw new Error("RPC 返回的链不是 X Layer");
    const result = {
      checkedAt: new Date().toISOString(),
      network: "X Layer",
      chainId: 196,
      contract: { address: contractAddress, status: "unavailable" },
      processor: processorAddress
        ? {
            address: processorAddress,
            status: "unavailable",
            circuitCount: null,
          }
        : { address: null, status: "not_provided", circuitCount: null },
      sources: { chainId: chain.endpoint },
    };
    try {
      const code = await rpc("eth_getCode", [contractAddress, "latest"]);
      if (!/^0x[0-9a-fA-F]*$/.test(code.value))
        throw new Error("合约代码响应格式错误");
      result.contract.status =
        code.value.length > 2 ? "code_present" : "no_code";
      result.sources.contract = code.endpoint;
    } catch (error) {
      result.contract.error = error.message;
    }
    if (processorAddress) {
      try {
        const registered = await rpc("eth_call", [
          { to: FACTORY, data: callIsCPU(processorAddress) },
          "latest",
        ]);
        result.sources.factory = registered.endpoint;
        if (uint(registered.value) === 0n) {
          result.processor.status = "not_registered";
        } else {
          result.processor.status = "registered";
          try {
            const count = await rpc("eth_call", [
              { to: processorAddress, data: SELECTORS.nextId },
              "latest",
            ]);
            result.processor.circuitCount = uint(count.value).toString();
            result.sources.circuitCount = count.endpoint;
          } catch (error) {
            result.processor.countError = error.message;
          }
        }
      } catch (error) {
        result.processor.error = error.message;
      }
    }
    return result;
  }
  return Object.freeze({
    FACTORY,
    SELECTORS,
    isAddress,
    callIsCPU,
    uint,
    verify,
  });
});
