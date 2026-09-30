# TRACE browser assets

Serve this directory as a static website. Open `index.html` through an HTTP server; no browser build or wallet connection is required.

`netlist.json` contains the exact eight-NAND design and its 16-row truth table. `chain.js` compares its verified Circuit #1 outputs read-only on X Layer. Run the tests from the repository root.

Vault policy sandbox source:

- `vault-circuit.js` — candidate eight-NAND design and 16-row truth table; not taped out.
- `vault-netlist.json` — reproducible candidate netlist and SHA-256.
- `vault-chain.js` — read-only, block-pinned ownership check for the existing Circuit #1.
- `vault-sandbox.js` — simulated window, claim-record, and budget inputs; no wallet signing or funds.
