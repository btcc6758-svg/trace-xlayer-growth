# TRACE · X Layer Project Growth Atlas

TRACE helps people discover newly indexed X Layer pools and see their public progress. Every fetched pool remains visible. Builders can also make a shareable project card that rechecks public X Layer and TapeOut facts when opened. A small TapeOut-compatible NAND circuit expresses two reproducible pool-presentation milestones: a discovery entry and a public-progress showcase. The circuit labels describe observations about a pool, not the quality of a project or its token.

The X Layer mainnet Processor and Circuit #1 are deployed through TapeOut. Two RPCs independently confirmed the tape-out event, NFT ownership and all 16 truth-table rows. The interface compares each selected pool's local result with a read-only mainnet call.

**Demo:** https://trace-xlayer-growth.ccawaa.chatgpt.site · **Source:** https://github.com/btcc6758-svg/trace-xlayer-growth

## Product flow

1. Load X Layer new pools from [GeckoTerminal's public API](https://api.geckoterminal.com/api/v2/networks/x-layer/new_pools?page=1), with a button for additional pages. Only loaded pages are represented; this is not a complete X Layer project directory.
2. Display every fetched pool, including records with missing fields. Search filters only the loaded list. Each item links to the pool data and, where available, the token contract explorer.
3. Explain the pool's creation time, estimated USD reserve, reported 24-hour volume and buy/sell counts. Show exactly which inputs and NAND gates produced its presentation stage.
4. Download a JSON snapshot with the observed fields, source page and time, policy thresholds, input/output bits, gate trace and netlist SHA-256. This preserves what the interface displayed at that time; it does not make external indexer data immutable.
5. A builder can enter a project name, X Layer contract, optional TapeOut Processor, public GitHub and demo link. TRACE checks whether the contract address returns code, whether the Processor is registered by the official TapeOut factory, the Processor's reported circuit count, and whether the GitHub repository is public. The profile becomes a shareable URL; opening it runs the checks again.
6. Compare the local result to a read-only X Layer `eval(uint256,bytes)` call to Circuit #1. The UI shows whether the outputs match and marks RPC failures or mismatches explicitly.

The builder card is self-service, with no account, wallet connection, backend submission or ownership signature. The project name, demo link and relationship between the entered contract and Processor are **self-reported and not verified**. `eth_getCode` establishes the presence of bytecode, not contract safety. GitHub's public repository response establishes accessibility, not authorship. RPC and GitHub failures appear as unavailable rather than as proof of absence; the card identifies a GitHub API rate limit separately. The share URL contains the entered public fields, and no centralized project directory stores it yet.

## Circuit specification

| Bit | Input              | Public observation                                                            |
| --- | ------------------ | ----------------------------------------------------------------------------- |
| 0   | `dataValid`        | Pool creation time, reserve and 24-hour buy/sell counts are present and valid |
| 1   | `depthReady`       | Indexer-estimated reserve is at least $10,000                                 |
| 2   | `freshPool`        | Pool creation was less than 24 hours ago                                      |
| 3   | `activityObserved` | Reported 24-hour buys plus sells total at least 20 transactions               |

The outputs are:

```
discover = dataValid AND (freshPool OR (depthReady AND activityObserved))
showcase = dataValid AND depthReady AND activityObserved
```

If `dataValid = 0`, the interface displays **资料待补**. Otherwise `(discover, showcase)` maps to `(0,0)` 持续建设, `(1,0)` 新项目发现, and `(1,1)` 公开进展. Every stage remains in the list. The thresholds are experimental, published presentation rules, not a reward, listing or investment eligibility policy. Transaction counts do not establish unique people or organic trading. Estimated reserve is not a guaranteed exit quote. A newly indexed pool is not the whole project, and pool creation time is not project creation time.

The [netlist](dist/netlist.json) contains eight NAND gates, four inputs, two outputs and 56 bytes. Each NAND instruction is opcode `0x00` followed by two big-endian 24-bit signal indices. `export-netlist.js` generates the exact bytes, SHA-256 and 16-row truth table. This format was checked against TapeOut's official frontend decoder.

## Run and verify

No install or build is needed for the site:

```
py -3.11 -m http.server 8766 --directory dist
node circuit.test.js
node chain.test.js
node builder-chain.test.js
node export-netlist.js
```

For mainnet preparation, install the locked development dependency with `npm ci`, then run `node scripts/prepare-mainnet.mjs --deployer <public X Layer address> --output deployment-review.json`. This command only reads two X Layer RPCs. It verifies chain ID, factory bytecode, factory fee, an existing factory-listed Processor's mint and tape-out fees, and the deployer's balance. When that balance covers the creation fee, it also uses `eth_call` and `eth_estimateGas` to test the proposed `createCPU` transaction without broadcasting. It encodes the call into an ignored local review file; it never signs or sends. On a Windows machine using an HTTP proxy, set `NODE_USE_ENV_PROXY=1` for Node's network calls.

After a confirmed creation transaction, run `node scripts/verify-creation.mjs --tx <full transaction hash> --creator <public X Layer address> --output creation-verification.json`. This read-only check requires the factory's `CPUCreated` event, successful receipt, matching creator and immutable issuance terms, deployed code, factory registration, and matching state from the new contracts on both RPCs. The wallet CLI routed this creation through a relay, so the receipt's top-level `from` and `to` are the relay path; the factory event and contract state identify the creator. The ignored output contains the next mint and tape-out call data for separate review.

The browser does not connect a wallet or trade. When the API fails, TRACE retains existing records and shows the source error; it does not interpret an outage as no projects.

Use `node scripts/verify-mint.mjs --tx <mint transaction> --wallet <deployment wallet> --transistors <ERC-1155 contract> --output mint-verification.json` to check the successful receipt, an eight-NAND ERC-1155 mint event and current balance on both RPCs. After tape-out, `node scripts/verify-tapeout.mjs --tx <tape-out transaction> --processor <Circuits contract> --author <deployment wallet> --output tapeout-verification.json` checks the event, NFT owner, circuit dimensions and all 16 truth-table rows on both RPCs. These snapshots are ignored local files.

## Mainnet status and issuance

The [hackathon rules](https://ignix.bot/x_campaign) require a Processor created through the TapeOut factory on X Layer mainnet and at least one circuit taped out before the deadline. The creation transaction [succeeded on X Layer](https://www.oklink.com/xlayer/tx/0x34c4d8ef5f94775d83b8096b4ad7b5c032df700fadf3dc09dc049686fc4d769f). Circuit #1 [tape-out succeeded](https://www.oklink.com/xlayer/tx/0xf93f8803387a747c83ada2b4f69d977f674be2059b229b06a6227d7dd9e8510c) at block 71630664. On 26 September 2026, two X Layer RPCs agreed on the event, NFT owner, 4 inputs, 2 outputs, 8 gates, and all 16 local truth-table rows. `dist/chain.js` contains the verified identifiers and enables the browser's read-only comparison.

| Mainnet identifier | Verified value |
| --- | --- |
| Deployment wallet | `0x1d207352dd708498cada1524eb4b36b5fa178886` |
| Processor / Circuits | `0x7761cE17a2e75C6910f1D5a77E6F66CD9Ca1274a` |
| Transistors / ERC-1155 | `0x9F842F33147E477e1219e753e2929e1DFc0Fe16C` |
| Factory creation transaction | `0x34c4d8ef5f94775d83b8096b4ad7b5c032df700fadf3dc09dc049686fc4d769f` |
| Eight-NAND mint transaction | `0x6e8b770492acbdeefe672fba386b4de03211d417c80bce20f4f849ff14c0efab` |
| Circuit ID | `1` |
| Tape-out transaction | `0xf93f8803387a747c83ada2b4f69d977f674be2059b229b06a6227d7dd9e8510c` |

| Parameter             | Verified / submitted        |
| --------------------- | --------------------------- |
| Processor name        | TRACE Growth Processor      |
| Symbol                | TRACE                       |
| Transistor supply cap | 100,000                     |
| NAND unit mint price  | 0.00001 OKB                 |
| First circuit         | 8 NAND, 4 inputs, 2 outputs |

Name, cap and mint price were verified on the new contracts; `TRACE` is the submitted symbol parameter. Creation paid 0.0066 OKB, minting eight NAND paid 0.00074 OKB including the 0.00066 OKB mint protocol fee, and tape-out paid 0.0013 OKB. The completed three transactions paid **0.00864 OKB** in protocol payments and mint price, excluding any network gas. See [launch-checklist.md](launch-checklist.md) for verification steps.

## Submission status

The public source repository is [btcc6758-svg/trace-xlayer-growth](https://github.com/btcc6758-svg/trace-xlayer-growth). Processor creation, the eight-NAND mint and Circuit #1 tape-out are verified on mainnet. The demo is public. Registration remains paused by user request; a form visit or click without a recorded confirmation does not establish that an entry was submitted. [submission-draft.md](submission-draft.md) tracks the evidence fields.
