import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  getAddress,
  Interface,
  formatEther,
  keccak256,
  parseEther,
} from "ethers";

const { values } = parseArgs({
  options: {
    deployer: { type: "string" },
    output: { type: "string" },
  },
});
if (!values.deployer) throw new Error("Pass --deployer 0x… (a public address)");

getAddress(values.deployer);
const deployer = values.deployer;
const config = JSON.parse(
  await readFile(new URL("../deployment-config.json", import.meta.url), "utf8"),
);
const endpoints = ["https://xlayerrpc.okx.com", "https://rpc.xlayer.tech"];
const factory = new Interface([
  "function deployFee() view returns (uint256)",
  "function cpuCount() view returns (uint256)",
  "function cpuAt(uint256) view returns (address)",
  "function isCPU(address) view returns (bool)",
  "function createCPU(string name, string symbol, string story, uint256 transistorSupply, uint256 mintPrice) payable returns (address transistors, address circuits)",
]);
const cpu = new Interface([
  "function transistors() view returns (address)",
  "function TAPEOUT_FEE() view returns (uint256)",
]);
const transistors = new Interface([
  "function protocolFee() view returns (uint256)",
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
  if (typeof body.result !== "string")
    throw new Error(`${endpoint}: missing ${method} result`);
  return body.result;
}

async function call(endpoint, address, abi, method, args = []) {
  const data = abi.encodeFunctionData(method, args);
  const result = await rpc(endpoint, "eth_call", [
    { to: address, data },
    "latest",
  ]);
  return abi.decodeFunctionResult(method, result)[0];
}

async function snapshot(endpoint) {
  const chainId = BigInt(await rpc(endpoint, "eth_chainId", []));
  if (chainId !== BigInt(config.chainId))
    throw new Error(
      `${endpoint}: expected chain ${config.chainId}, got ${chainId}`,
    );
  const [code, deployFee, cpuCount, balance] = await Promise.all([
    rpc(endpoint, "eth_getCode", [config.factory, "latest"]),
    call(endpoint, config.factory, factory, "deployFee"),
    call(endpoint, config.factory, factory, "cpuCount"),
    rpc(endpoint, "eth_getBalance", [deployer, "latest"]),
  ]);
  if (code === "0x" || !/^0x[0-9a-fA-F]+$/.test(code))
    throw new Error(`${endpoint}: factory has no valid code`);
  if (cpuCount < 1n) throw new Error(`${endpoint}: no reference processor`);
  const referenceProcessor = getAddress(
    await call(endpoint, config.factory, factory, "cpuAt", [0n]),
  );
  const registered = await call(endpoint, config.factory, factory, "isCPU", [
    referenceProcessor,
  ]);
  if (!registered)
    throw new Error(`${endpoint}: factory did not recognize reference CPU`);
  const referenceTransistors = getAddress(
    await call(endpoint, referenceProcessor, cpu, "transistors"),
  );
  const [mintProtocolFee, tapeoutFee] = await Promise.all([
    call(endpoint, referenceTransistors, transistors, "protocolFee"),
    call(endpoint, referenceProcessor, cpu, "TAPEOUT_FEE"),
  ]);
  return {
    endpoint,
    chainId: Number(chainId),
    factoryCodeHash: keccak256(code),
    deployFeeWei: deployFee.toString(),
    factoryCpuCount: cpuCount.toString(),
    walletBalanceWei: BigInt(balance).toString(),
    referenceOnly: {
      processor: referenceProcessor,
      transistors: referenceTransistors,
      mintProtocolFeeWei: mintProtocolFee.toString(),
      tapeoutFeeWei: tapeoutFee.toString(),
    },
  };
}

const [a, b] = await Promise.all(endpoints.map(snapshot));
for (const key of [
  "chainId",
  "factoryCodeHash",
  "deployFeeWei",
  "walletBalanceWei",
]) {
  if (a[key] !== b[key]) throw new Error(`RPC disagreement: ${key}`);
}
for (const key of [
  "processor",
  "transistors",
  "mintProtocolFeeWei",
  "tapeoutFeeWei",
]) {
  if (a.referenceOnly[key] !== b.referenceOnly[key])
    throw new Error(`RPC disagreement: reference ${key}`);
}

const proposal = config.processor;
const mintPriceWei = parseEther(proposal.mintPriceOkb);
const deployFeeWei = BigInt(a.deployFeeWei);
const referenceMintFee = BigInt(a.referenceOnly.mintProtocolFeeWei);
const referenceTapeoutFee = BigInt(a.referenceOnly.tapeoutFeeWei);
const firstMintValue =
  referenceMintFee + BigInt(config.firstCircuit.nandCount) * mintPriceWei;
const illustrativeTotal = deployFeeWei + firstMintValue + referenceTapeoutFee;
const data = factory.encodeFunctionData("createCPU", [
  proposal.name,
  proposal.symbol,
  proposal.story,
  BigInt(proposal.transistorSupply),
  mintPriceWei,
]);
let creationSimulation;
if (BigInt(a.walletBalanceWei) >= deployFeeWei) {
  const tx = {
    from: deployer,
    to: config.factory,
    value: `0x${deployFeeWei.toString(16)}`,
    data,
  };
  const simulations = await Promise.all(
    endpoints.map(async (endpoint) => {
      const result = await rpc(endpoint, "eth_call", [tx, "latest"]);
      const decoded = factory.decodeFunctionResult("createCPU", result);
      getAddress(decoded[0]);
      getAddress(decoded[1]);
      let estimatedGas;
      try {
        estimatedGas = BigInt(
          await rpc(endpoint, "eth_estimateGas", [tx]),
        ).toString();
      } catch (error) {
        estimatedGas = `unavailable: ${error.message}`;
      }
      return { rpc: endpoint, ethCallSucceeded: true, estimatedGas };
    }),
  );
  creationSimulation = {
    status: "read-only eth_call on two RPCs; no contract was deployed",
    results: simulations,
  };
} else {
  creationSimulation = {
    status: "not run: deployer balance below current creation fee",
  };
}

const review = {
  checkedAt: new Date().toISOString(),
  status: "read-only proposal; no transaction was signed or sent",
  deploymentWallet: deployer,
  chainId: config.chainId,
  factory: config.factory,
  factoryCodeHash: a.factoryCodeHash,
  processorProposal: {
    ...proposal,
    mintPriceWei: mintPriceWei.toString(),
  },
  creationTransaction: {
    from: deployer,
    to: config.factory,
    valueWei: a.deployFeeWei,
    valueOkb: formatEther(deployFeeWei),
    data,
    dataKeccak256: keccak256(data),
  },
  creationSimulation,
  walletBalance: {
    wei: a.walletBalanceWei,
    okb: formatEther(BigInt(a.walletBalanceWei)),
    canPayCreationFee: BigInt(a.walletBalanceWei) >= deployFeeWei,
  },
  laterTransactionEstimate: {
    source: "fees read from an existing factory-listed processor, not TRACE",
    referenceProcessor: a.referenceOnly.processor,
    referenceTransistors: a.referenceOnly.transistors,
    mintProtocolFeeWei: referenceMintFee.toString(),
    tapeoutFeeWei: referenceTapeoutFee.toString(),
    proposedEightNandMintWei: firstMintValue.toString(),
    illustrativeThreeStepTotalOkb: formatEther(illustrativeTotal),
    excludesGasAndFutureFeeChanges: true,
  },
  sources: endpoints.map((endpoint) => ({ rpc: endpoint })),
};

const output = JSON.stringify(review, null, 2) + "\n";
if (values.output) await writeFile(values.output, output, "utf8");
console.log(output);
