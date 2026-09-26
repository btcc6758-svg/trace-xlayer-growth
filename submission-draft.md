# TapeOut Genesis Transistor Hackathon · submission draft

**Project name:** TRACE · X Layer Project Growth Atlas

**Status:** Draft. The Processor is verified on X Layer mainnet. Circuit tape-out and public links are still required.

## Project description

TRACE helps people discover newly indexed X Layer projects through a source-linked pool list. It displays each loaded pool's public progress without hiding early or incomplete records. Builders can also create a shareable project card: on opening the link, TRACE checks whether the entered X Layer contract has code, whether the entered Processor is registered by the TapeOut factory, how many circuits its `nextId()` reports, and whether the entered GitHub repository is public. This gives builders a concrete way to show verifiable milestones alongside their product links.

An eight-NAND TapeOut circuit turns four transparent pool observations into two presentation milestones: discovery entry and public-progress showcase. Users can inspect every input and gate, export a dated evidence snapshot and, after mainnet tape-out, compare the result with a read-only X Layer Processor call.

The tool is designed to give new projects visibility while making the presentation rules reproducible. A card's project name, demo link and relationship between entered addresses are self-reported; code presence, factory registration, circuit count and public-repository accessibility are limited read-only checks. The card does not verify project ownership, contract safety or GitHub authorship. Its labels are not official endorsements, reward eligibility decisions or investment advice. External pool data and transaction counts are not independently verified by the circuit.

## Public evidence to insert

| Field                                 | Value                                                |
| ------------------------------------- | ---------------------------------------------------- |
| X Layer Processor (Circuits) contract | `0x7761cE17a2e75C6910f1D5a77E6F66CD9Ca1274a`    |
| Transistor ERC-1155 contract          | `0x9F842F33147E477e1219e753e2929e1DFc0Fe16C`    |
| Deployment wallet                     | `0x1d207352dd708498cada1524eb4b36b5fa178886`    |
| Factory creation transaction          | `0x34c4d8ef5f94775d83b8096b4ad7b5c032df700fadf3dc09dc049686fc4d769f` |
| Mint transaction                      | `0x6e8b770492acbdeefe672fba386b4de03211d417c80bce20f4f849ff14c0efab` |
| Tape-out transaction                  | Pending                                              |
| Circuit ID                            | Pending                                              |
| Public GitHub repository              | https://github.com/btcc6758-svg/trace-xlayer-growth |
| Public product demo                   | Pending public release; the Sites preview is private |
| Demo video                            | Pending recording                                    |
| Optional X introduction post          | Pending                                              |

The [entry form](https://docs.google.com/forms/d/e/1FAIpQLSd7USjG6LUNNRxwFWY4YEuSY0V0xv8VZNCl6z_-lGSl96vWZA/viewform?usp=dialog) asks for project name, description, Telegram contact, email and public GitHub repository; X post is optional. The [official rules](https://ignix.bot/x_campaign) also require a Processor address, deployment wallet and product demo. Put those identifiers in the form description and at the top of the public README if there are no dedicated fields. All submitted links must work for judges without login.

## Suggested 90-second demo

1. Show the complete loaded new-pool list and source timestamp. Pick a newly indexed pool, including one that has not reached a display milestone.
2. Open its source data and explain the pool creation time, reserve and transaction-count observations. Show the two circuit output bits and the eight NAND gates.
3. Create a builder card for TRACE using its real deployed contract, TapeOut Processor, public repository and demo. Open its share URL to show the fresh factory, circuit-count and GitHub checks. Explain that the project name and relationship between addresses are self-reported.
4. Show the tape-out transaction and read-only `eval` result matching the pool's local bits. Export the dated snapshot.
5. Explain how a project can become discoverable without a negative label. State the limit: presentation milestones do not prove organic activity or project quality.
