import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { getAddress, Interface, getBytes } from "ethers";

const { values } = parseArgs({
  options: {
    tx: { type: "string" },
    processor: { type: "string" },
    author: { type: "string" },
    output: { type: "string" },
  },
});
if (!/^0x[0-9a-fA-F]{64}$/.test(values.tx || ""))
  throw new Error("Pass --tx with the full transaction hash");
const processor = getAddress(values.processor);
const author = getAddress(values.author);
const netlist = JSON.parse(
  await readFile(new URL("../dist/netlist.json", import.meta.url), "utf8"),
);
const digest = "0x" + createHash("sha256").update(getBytes(netlist.netlist)).digest("hex");
if (digest !== netlist.sha256)
  throw new Error("Checked-in netlist SHA-256 mismatch");
const abi = new Interface([
  "event TapedOut(uint256 indexed circuitId, address indexed author, uint32 gateCount, uint32 nState)",
  "function circuitInfo(uint256 id) view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount)",
  "function ownerOf(uint256 id) view returns (address)",
  "function eval(uint256 id, bytes inputs) view returns (bytes)",
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
    { to: processor, data: abi.encodeFunctionData(method, args) },
    "latest",
  ]);
  return abi.decodeFunctionResult(method, result);
}

async function inspect(endpoint) {
  if (BigInt(await rpc(endpoint, "eth_chainId", [])) !== 196n)
    throw new Error(`${endpoint}: wrong chain`);
  const receipt = await rpc(endpoint, "eth_getTransactionReceipt", [values.tx]);
  if (!receipt || BigInt(receipt.status) !== 1n)
    throw new Error(`${endpoint}: missing or reverted tape-out receipt`);
  const events = (receipt.logs || [])
    .filter((log) => getAddress(log.address) === processor)
    .flatMap((log) => {
      try {
        const parsed = abi.parseLog(log);
        return parsed?.name === "TapedOut" ? [parsed] : [];
      } catch {
        return [];
      }
    });
  if (events.length !== 1)
    throw new Error(`${endpoint}: expected exactly one TapedOut event`);
  const { circuitId, author: eventAuthor, gateCount, nState } = events[0].args;
  if (getAddress(eventAuthor) !== author)
    throw new Error(`${endpoint}: tape-out author differs from reviewed wallet`);
  if (gateCount !== BigInt(netlist.nandCount) || nState !== 0n)
    throw new Error(`${endpoint}: taped-out gate or state count differs`);
  const [info, owner] = await Promise.all([
    call(endpoint, "circuitInfo", [circuitId]),
    call(endpoint, "ownerOf", [circuitId]),
  ]);
  if (
    info[0] !== BigInt(netlist.nIn) ||
    info[1] !== BigInt(netlist.nOut) ||
    info[2] !== 0n ||
    info[3] !== BigInt(netlist.nandCount)
  )
    throw new Error(`${endpoint}: circuitInfo differs from checked-in design`);
  if (getAddress(owner[0]) !== author)
    throw new Error(`${endpoint}: circuit NFT owner differs from reviewed wallet`);
  const rows = [];
  for (let i = 0; i < 16; i++) {
    const input = "0x" + i.toString(16).padStart(2, "0");
    const [output] = await call(endpoint, "eval", [circuitId, input]);
    const bytes = getBytes(output);
    if (bytes.length < 1) throw new Error(`${endpoint}: empty output for row ${i}`);
    const actual = [bytes[0] & 1, (bytes[0] >> 1) & 1];
    const expected = netlist.truthTable[i]?.outputs;
    if (!expected || actual.some((bit, n) => bit !== expected[n]))
      throw new Error(`${endpoint}: output mismatch for row ${i}`);
    rows.push({ input, output, bits: actual });
  }
  return {
    rpc: endpoint,
    transactionHash: receipt.transactionHash,
    blockNumber: Number(BigInt(receipt.blockNumber)),
    processor,
    circuitId: circuitId.toString(),
    author,
    owner: getAddress(owner[0]),
    nIn: Number(info[0]),
    nOut: Number(info[1]),
    nState: Number(info[2]),
    gateCount: Number(info[3]),
    netlistSha256: digest,
    truthTableRowsMatched: rows.length,
  };
}

const [a, b] = await Promise.all(endpoints.map(inspect));
for (const key of Object.keys(a)) {
  if (key !== "rpc" && a[key] !== b[key])
    throw new Error(`RPC disagreement: ${key}`);
}
const report = {
  checkedAt: new Date().toISOString(),
  status: "tape-out and all 16 truth-table rows verified on two RPCs",
  result: a,
};
const output = JSON.stringify(report, null, 2) + "\n";
if (values.output) await writeFile(values.output, output, "utf8");
console.log(output);
