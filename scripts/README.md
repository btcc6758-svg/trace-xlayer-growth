# Read-only mainnet verification

Install the locked development dependency with `npm ci` from the repository root. These scripts query public X Layer RPCs and encode review data; they never sign or broadcast transactions.

- `prepare-mainnet.mjs`: prepare the Processor creation review.
- `verify-creation.mjs`: check the factory event and deployed issuance terms.
- `verify-mint.mjs`: check the eight-NAND mint event and balance.
- `verify-tapeout.mjs`: check the Circuit event, dimensions, owner and all 16 truth-table rows.

See the root README for arguments. Local review snapshots and contact information are Git-ignored.
