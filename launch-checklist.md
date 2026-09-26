# TRACE · X Layer launch checklist

The [entry form](https://docs.google.com/forms/d/e/1FAIpQLSd7USjG6LUNNRxwFWY4YEuSY0V0xv8VZNCl6z_-lGSl96vWZA/viewform?usp=dialog) gives the window as **22 September 2026, 12:00 to 6 October 2026, 12:00 HKT**. Complete and verify these items before submitting. HKT and Beijing time are both UTC+8.

## Mainnet transactions

The deployment wallet is `0x1d207352dd708498cada1524eb4b36b5fa178886`. Re-read wallet balance and contract fees before the remaining transactions. `node scripts/prepare-mainnet.mjs --deployer <public X Layer address> --output deployment-review.json` creates a read-only review snapshot; the local JSON is Git-ignored.

1. On X Layer **chain ID 196**, call TapeOut factory `0x1f09daefa827f02cbb40967cc91b259763760761`:

   `createCPU(string name, string symbol, string story, uint256 transistorSupply, uint256 mintPrice)`

   Created with name `TRACE Growth Processor`, submitted symbol `TRACE`, story `An X Layer project discovery circuit that turns public pool observations into transparent presentation milestones. Every project stays visible; outputs do not attest to organic activity, project quality or returns.`, supply cap `100000`, price `10000000000000` wei (`0.00001 OKB`) per transistor, and a factory fee of 0.0066 OKB. Transaction `0x34c4d8ef5f94775d83b8096b4ad7b5c032df700fadf3dc09dc049686fc4d769f` succeeded. The factory `CPUCreated` event identifies Circuits `0x7761cE17a2e75C6910f1D5a77E6F66CD9Ca1274a` and Transistors `0x9F842F33147E477e1219e753e2929e1DFc0Fe16C`, with the above wallet as creator. The wallet service sent the transaction through a relay, so the receipt's top-level `from` and `to` are relay addresses.

2. `mint(0, 8)` succeeded with value 0.00074 OKB in transaction `0x6e8b770492acbdeefe672fba386b4de03211d417c80bce20f4f849ff14c0efab`. The wallet transaction record reports `SUCCESS`; `scripts/verify-mint.mjs` checked the receipt, eight-NAND mint event and wallet NAND balance of 8 on both RPCs.

3. On the newly created Circuits contract, read `TAPEOUT_FEE()`. Call `tapeout(bytes nl, uint32 nIn, uint32 nOut)` with the exact `netlist` bytes from [`dist/netlist.json`](dist/netlist.json), `nIn = 4`, `nOut = 2`, and current fee as value. Record the `TapedOut` event's circuit ID and transaction hash. Confirm `circuitInfo(id)` reports 4 inputs, 2 outputs and 8 gates.

4. Call `eval(uint256,bytes)` read-only for all 16 input combinations. The single input byte packs input bit 0 into the least significant bit. Compare both output bits against the checked-in truth table. Only then fill `dist/chain.js` with the processor address and circuit ID, publish the site again, and mark it as mainnet verified.

The two new TRACE contracts currently report a 0.00066 OKB mint protocol fee and a 0.0013 OKB tape-out fee. With the verified 0.00001 OKB unit price, the total for all three transactions is **0.00864 OKB** in protocol payments and mint price, excluding network gas. Re-read actual contract methods, addresses, value and balance before each signature. A submitted transaction hash is not proof of success; the receipt and contract state are the evidence.

## Public entry evidence

- [x] Public GitHub repository: https://github.com/btcc6758-svg/trace-xlayer-growth, with source, transaction identifiers, processor and Transistors addresses, supply/price terms, and test instructions.
- [ ] Public product demo with the verified circuit comparison. The current Sites deployment is owner-private and does not satisfy the form's public-link requirement.
- [ ] A short demo recording showing a live pool, its source fields, bit inputs, 8-gate trace and matching on-chain result.
- [ ] Project name, description, Telegram contact, contact email and GitHub URL entered in the form; include the processor contract, deployment wallet and demo links in the description. An X post link is optional on the form.
- [ ] Submission confirmation captured before **6 October 2026, 12:00 HKT**.

## Top-three priorities

The [official rules](https://ignix.bot/x_campaign) judge innovation, TapeOut integration, completeness, issuance design, X Layer integration, growth, security and economic model. The prototype demonstrates transparent project discovery, a self-service builder card and a factory-registered Processor, but has **no taped-out Circuit, outside users or adoption evidence yet**. The strongest next proof is a successful mainnet read-only comparison in the live product, then genuine builders sharing cards for their own milestones. Before presenting a builder card as project-authenticated, add a way to prove control of the named project's contract or public profile; the current card only verifies public facts about entered addresses and links. Do not simulate volume or user activity: the rules disqualify fake trading.
