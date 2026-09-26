# TRACE · X Layer launch checklist

The official entry form gives the window as 22 September 2026, 12:00 to 6 October 2026, 12:00 HKT (UTC+8).

## Completed mainnet evidence

Deployment wallet: 0x1d207352dd708498cada1524eb4b36b5fa178886

Processor / Circuits: 0x7761cE17a2e75C6910f1D5a77E6F66CD9Ca1274a

Transistors / ERC-1155: 0x9F842F33147E477e1219e753e2929e1DFc0Fe16C

- [x] Factory creation succeeded: 0x34c4d8ef5f94775d83b8096b4ad7b5c032df700fadf3dc09dc049686fc4d769f. Name TRACE Growth Processor, submitted symbol TRACE, supply cap 100000 and NAND unit price 0.00001 OKB. The factory event and contract state identify the creator; the transaction used a relay.
- [x] Mint(0,8) succeeded: 0x6e8b770492acbdeefe672fba386b4de03211d417c80bce20f4f849ff14c0efab. Both RPCs confirmed the eight-NAND mint event.
- [x] Circuit #1 tape-out succeeded: 0xf93f8803387a747c83ada2b4f69d977f674be2059b229b06a6227d7dd9e8510c at block 71630664. Both RPCs confirmed the NFT owner, 4 inputs, 2 outputs, no state and 8 gates.
- [x] All 16 input combinations matched the local truth table on both RPCs. The frontend TraceChain implementation also matched all 16 mainnet outputs.

Creation paid 0.0066 OKB; mint paid 0.00074 OKB including protocol fee; tape-out paid 0.0013 OKB. Total protocol payments and mint price: **0.00864 OKB**, excluding network gas. The exact 56-byte netlist and truth table are in [dist/netlist.json](dist/netlist.json). Verification scripts never sign or broadcast transactions.

## Public entry evidence

- [x] Public source: https://github.com/btcc6758-svg/trace-xlayer-growth
- [x] Public demo with read-only Circuit #1 comparison: https://trace-xlayer-growth.ccawaa.chatgpt.site
- [ ] Final entry confirmation. Project name, description, Telegram, email and GitHub are required; put Processor, wallet, Circuit #1 and demo links in the description.
- [ ] Optional short demo recording and X introduction post.

## Top-three priorities

TRACE demonstrates positive project discovery, transparent presentation milestones, a self-service shareable builder card and a verified TapeOut integration. There is no outside-user or adoption evidence yet. Genuine builders sharing their own cards and a concise demo recording would strengthen the evidence. Before claiming a card is authenticated by a project, add proof of control over its contract or public profile. Current read-only checks verify public facts about entered addresses and links, not ownership, quality or organic activity. Do not simulate volume or users: [official rules](https://ignix.bot/x_campaign) disqualify fake trading.
