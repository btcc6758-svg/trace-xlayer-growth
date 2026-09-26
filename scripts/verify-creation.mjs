import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { formatEther, getAddress, Interface, parseEther } from "ethers";

const { values } = parseArgs({
  options: {
    tx: { type: "string" },
    creator: { type: "string" },
    output: { type: "string" },
  },
});
if (!/^0x[0-9a-fA-F]{64}$/.test(values.tx || ""))
  throw new Error("Pass --tx with the full 0x transaction hash");
if (!values.creator)
  throw new Error("Pass --creator with the public wallet address");
getAddress(values.creator);

const config = JSON.parse(
  await readFile(new URL("../deployment-config.json", import.meta.url), "utf8"),
);
const endpoints = ["https://xlayerrpc.okx.com", "https://rpc.xlayer.tech"];
const factory = new Interface([
  "event CPUCreated(address indexed circuits, address indexed transistors, address indexed creator, string name, uint256 supply, uint256 mintPrice)",
  "function isCPU(address) view returns (bool)",
]);
const cpu = new Interface([
  "function transistors() view returns (address)",
  "function nextId() view returns (uint256)",
  "function TAPEOUT_FEE() view returns (uint256)",
  "function tapeout(bytes nl, uint32 nIn, uint32 nOut) payable returns (uint256)",
]);
const parts = new Interface([
  "function circuits() view returns (address)",
  "function creator() view returns (address)",
  "function cpuName() view returns (string)",
  "function story() view returns (string)",
  "function supplyCap() view returns (uint256)",
  "function minted() view returns (uint256)",
  "function mintPrice() view returns (uint256)",
  "function protocolFee() view returns (uint256)",
  "function balanceOf(address, uint256) view returns (uint256)",
  "function mint(uint256, uint256) payable",
]);

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

async function call(endpoint, address, abi, method, args = []) {
  const result = await rpc(endpoint, "eth_call", [
    { to: address, data: abi.encodeFunctionData(method, args) },
    "latest",
  ]);
  if (typeof result !== "string")
    throw new Error(`${endpoint}: missing ${method} result`);
  return abi.decodeFunctionResult(method, result)[0];
}

async function inspect(endpoint) {
  const chainId = BigInt(await rpc(endpoint, "eth_chainId", []));
  if (chainId !== BigInt(config.chainId))
    throw new Error(`${endpoint}: wrong chain ${chainId}`);
  const receipt = await rpc(endpoint, "eth_getTransactionReceipt", [values.tx]);
  if (!receipt)
    throw new Error(`${endpoint}: transaction receipt not yet available`);
  if (BigInt(receipt.status) !== 1n)
    throw new Error(`${endpoint}: transaction reverted`);
  // Wallet contract calls can arrive through an account-abstraction relay.
  // The factory event and both deployed contracts bind the actual creator.
  const events = (receipt.logs || [])
    .filter((log) => getAddress(log.address) === getAddress(config.factory))
    .flatMap((log) => {
      try {
        const parsed = factory.parseLog(log);
        return parsed?.name === "CPUCreated" ? [parsed] : [];
      } catch {
        return [];
      }
    });
  if (events.length !== 1)
    throw new Error(`${endpoint}: expected exactly one CPUCreated event`);
  const event = events[0].args;
  const circuits = getAddress(event.circuits);
  const transistors = getAddress(event.transistors);
  if (getAddress(event.creator) !== getAddress(values.creator))
    throw new Error(`${endpoint}: CPUCreated creator differs`);
  if (
    event.name !== config.processor.name ||
    event.supply !== BigInt(config.processor.transistorSupply) ||
    event.mintPrice !== parseEther(config.processor.mintPriceOkb)
  )
    throw new Error(`${endpoint}: CPUCreated terms differ from proposal`);
  const [cpuCode, partsCode, registered] = await Promise.all([
    rpc(endpoint, "eth_getCode", [circuits, "latest"]),
    rpc(endpoint, "eth_getCode", [transistors, "latest"]),
    call(endpoint, config.factory, factory, "isCPU", [circuits]),
  ]);
  if (cpuCode === "0x" || partsCode === "0x" || !registered)
    throw new Error(
      `${endpoint}: new contracts or factory registration missing`,
    );
  const [
    cpuParts,
    nextId,
    tapeoutFee,
    partsCpu,
    creator,
    name,
    story,
    supplyCap,
    minted,
    mintPrice,
    protocolFee,
    nandBalance,
  ] = await Promise.all([
    call(endpoint, circuits, cpu, "transistors"),
    call(endpoint, circuits, cpu, "nextId"),
    call(endpoint, circuits, cpu, "TAPEOUT_FEE"),
    call(endpoint, transistors, parts, "circuits"),
    call(endpoint, transistors, parts, "creator"),
    call(endpoint, transistors, parts, "cpuName"),
    call(endpoint, transistors, parts, "story"),
    call(endpoint, transistors, parts, "supplyCap"),
    call(endpoint, transistors, parts, "minted"),
    call(endpoint, transistors, parts, "mintPrice"),
    call(endpoint, transistors, parts, "protocolFee"),
    call(endpoint, transistors, parts, "balanceOf", [values.creator, 0n]),
  ]);
  if (
    getAddress(cpuParts) !== transistors ||
    getAddress(partsCpu) !== circuits ||
    getAddress(creator) !== getAddress(values.creator) ||
    name !== config.processor.name ||
    story !== config.processor.story ||
    supplyCap !== BigInt(config.processor.transistorSupply) ||
    mintPrice !== parseEther(config.processor.mintPriceOkb)
  )
    throw new Error(
      `${endpoint}: deployed contract state differs from proposal`,
    );
  return {
    rpc: endpoint,
    transactionHash: receipt.transactionHash,
    blockNumber: Number(BigInt(receipt.blockNumber)),
    transactionFrom: getAddress(receipt.from),
    transactionTo: getAddress(receipt.to),
    circuits,
    transistors,
    supplyCap: supplyCap.toString(),
    minted: minted.toString(),
    mintPriceWei: mintPrice.toString(),
    protocolFeeWei: protocolFee.toString(),
    tapeoutFeeWei: tapeoutFee.toString(),
    circuitCount: nextId.toString(),
    creatorNandBalance: nandBalance.toString(),
  };
}

const [a, b] = await Promise.all(endpoints.map(inspect));
for (const key of Object.keys(a)) {
  if (key !== "rpc" && a[key] !== b[key])
    throw new Error(`RPC disagreement: ${key}`);
}
const neededNand = BigInt(config.firstCircuit.nandCount);
const toMint =
  neededNand > BigInt(a.creatorNandBalance)
    ? neededNand - BigInt(a.creatorNandBalance)
    : 0n;
const mintValue = toMint * BigInt(a.mintPriceWei) + BigInt(a.protocolFeeWei);
const netlist = JSON.parse(
  await readFile(new URL("../dist/netlist.json", import.meta.url), "utf8"),
);
if (
  netlist.nandCount !== config.firstCircuit.nandCount ||
  netlist.nIn !== config.firstCircuit.nIn ||
  netlist.nOut !== config.firstCircuit.nOut
)
  throw new Error("Checked-in circuit differs from deployment proposal");

const report = {
  checkedAt: new Date().toISOString(),
  status: "creation verified on two RPCs; no follow-up transaction sent",
  creation: a,
  nextMint:
    toMint > 0n
      ? {
          to: a.transistors,
          nandTokenId: 0,
          amount: toMint.toString(),
          valueWei: mintValue.toString(),
          valueOkb: formatEther(mintValue),
          data: parts.encodeFunctionData("mint", [0n, toMint]),
        }
      : { status: "creator already holds at least 8 NAND" },
  laterTapeout: {
    to: a.circuits,
    feeWei: a.tapeoutFeeWei,
    feeOkb: formatEther(BigInt(a.tapeoutFeeWei)),
    nIn: netlist.nIn,
    nOut: netlist.nOut,
    netlistSha256: netlist.sha256,
    data: cpu.encodeFunctionData("tapeout", [
      netlist.netlist,
      netlist.nIn,
      netlist.nOut,
    ]),
    note: "re-read fee and NAND balance after mint before any tape-out signature",
  },
};
const output = JSON.stringify(report, null, 2) + "\n";
if (values.output) await writeFile(values.output, output, "utf8");
console.log(output);
