import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { getAddress, Interface } from "ethers";

const { values } = parseArgs({
  options: {
    tx: { type: "string" },
    wallet: { type: "string" },
    transistors: { type: "string" },
    output: { type: "string" },
  },
});
if (!/^0x[0-9a-fA-F]{64}$/.test(values.tx || ""))
  throw new Error("Pass --tx with the full transaction hash");
const wallet = getAddress(values.wallet);
const transistors = getAddress(values.transistors);
const abi = new Interface([
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function minted() view returns (uint256)",
]);
const endpoints = ["https://xlayerrpc.okx.com", "https://rpc.xlayer.tech"];

async function rpc(endpoint, method, params) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${endpoint}: ${body.error.message}`);
  return body.result;
}

async function call(endpoint, method, args) {
  const result = await rpc(endpoint, "eth_call", [
    { to: transistors, data: abi.encodeFunctionData(method, args) },
    "latest",
  ]);
  return abi.decodeFunctionResult(method, result)[0];
}

async function inspect(endpoint) {
  if (BigInt(await rpc(endpoint, "eth_chainId", [])) !== 196n)
    throw new Error(`${endpoint}: wrong chain`);
  const receipt = await rpc(endpoint, "eth_getTransactionReceipt", [values.tx]);
  if (!receipt || BigInt(receipt.status) !== 1n)
    throw new Error(`${endpoint}: missing or reverted mint receipt`);
  const mints = (receipt.logs || [])
    .filter((log) => getAddress(log.address) === transistors)
    .flatMap((log) => {
      try {
        const parsed = abi.parseLog(log);
        return parsed?.name === "TransferSingle" ? [parsed.args] : [];
      } catch {
        return [];
      }
    })
    .filter(
      (event) =>
        getAddress(event.from) === "0x0000000000000000000000000000000000000000" &&
        getAddress(event.to) === wallet &&
        event.id === 0n &&
        event.value === 8n,
    );
  if (mints.length !== 1)
    throw new Error(`${endpoint}: expected one 8-NAND mint event to wallet`);
  const [nandBalance, minted] = await Promise.all([
    call(endpoint, "balanceOf", [wallet, 0n]),
    call(endpoint, "minted", []),
  ]);
  if (nandBalance < 8n || minted < 8n)
    throw new Error(`${endpoint}: NAND balance or total minted is below 8`);
  return {
    rpc: endpoint,
    transactionHash: receipt.transactionHash,
    blockNumber: Number(BigInt(receipt.blockNumber)),
    transistors,
    wallet,
    nandMintedInTransaction: "8",
    walletNandBalance: nandBalance.toString(),
    totalMinted: minted.toString(),
  };
}

const [a, b] = await Promise.all(endpoints.map(inspect));
for (const key of Object.keys(a)) {
  if (key !== "rpc" && a[key] !== b[key])
    throw new Error(`RPC disagreement: ${key}`);
}
const report = {
  checkedAt: new Date().toISOString(),
  status: "8-NAND mint verified on two RPCs",
  result: a,
};
const output = JSON.stringify(report, null, 2) + "\n";
if (values.output) await writeFile(values.output, output, "utf8");
console.log(output);
