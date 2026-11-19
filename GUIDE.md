# Coiner launch and profitability guide

This is the operating SOP for Coiner's SOL-paired Pump lifecycle. Read the [PRD requirements](PRD.md#7-launch-strategy-and-evidence), then check the [live progress tracker](https://md.codev.id/#/OPERATIONS/PROJECTS/COINER_SCOUT_PRODUCTION_CLOSURE.md) for funding, approvals, and outstanding transactions. The former 1-to-100 SOL ladder used selected anecdotes, unverified demand assumptions, and inconsistent exit arithmetic. Its historical versions remain available in Git history.

## Decide what the run can prove

| Run | Evidence it can produce |
|---|---|
| Funded Devnet or local fork | The code can sign, launch, buy, sell, settle and recover a position on that test environment. |
| Funded signed Mainnet simulation | The exact transaction fits, executes against live program state, and passes the simulated launch debit cap. |
| One authorized Mainnet trial | The live transaction path, closed-position proceeds and actual all-in cost for that run. |
| Chronological strategy evaluation | Evidence for or against positive average net returns over the measured period. A single trial or a successful execution test is insufficient. |

Before a real launch, confirm that the project and its creator allocation can be described transparently. Use original or authorized artwork, a consistent name and ticker, and project-owned social links. Obtain operator approval for the candidate, wallet, scope and maximum SOL at risk. Treat paid promotion as a disclosed expense. Exclude wash trades, fabricated demand, and undisclosed coordinated buying from both operations and evidence. Follow authorized data sources and current venue terms. [Pump terms, section 21](https://pump.fun/docs/terms-and-conditions#21-prohibited-use)

## Launch checklist

1. **Stage and review.** Run `pnpm cli scout --limit 3` to collect leads. Scout rank, paid boosts and AI suggestions are candidate inputs. Review asset rights, metadata JSON and its image, name, ticker, creator allocation and disclosure. For the first Mainnet trial, use the specific reviewed metadata URI. Production pinning is available through the authenticated Pages proxy with the scoped upload token and server-side Pinata credential.
2. **Fix the limits.** Record network, signer address, candidate, maximum funded exposure, buy cap, total simulated launch cap, exit fee reserve, slippage, timeout and the single position path. Recheck program, fee and cluster state. `--max-spend-sol` is a simulation check for launch debit. Limit the dedicated wallet's funding to the approved amount.
3. **Simulate.** Run `create --target pump --simulate` using the deployed version, funded signer, exact metadata, and buy and launch caps. Check both signatures, the packet size, the projected post-launch wallet and an adequate exit reserve. Rerun with the exact values after any change. Pump publishes the fee schedule and the SDK reads live fee state. [Pump fees](https://pump.fun/docs/fees) · [Solana fees](https://solana.com/docs/core/fees)
4. **Execute one authorized lifecycle.** Use the same settings without the simulation flag, add `--auto-exit` and a new private position file, and keep that file through settlement. Read back both finalized receipts, SOL or WSOL changes, fees, and the final token balance. Record the result even if the launch fails or the venue cannot fill the sale.
5. **Reconcile before any new launch.** Use `watch` on the same file for pending transactions or open positions. Escalate when the configured loss, exposure or attempt budget is exhausted, market or fee data cannot be verified, or the receipt does not match the wallet. A position without a valid exit stays open on the ledger. [Funding and recovery runbook](https://md.codev.id/#/KNOWLEDGE/KNOWLEDGE-COINER-PUMP-SOLANA-LIFECYCLE.md)

### CLI lifecycle verification and recovery

The verified release performed launch and automatic curve exit on public Devnet and exercised PumpSwap migration and liquidation separately on the local fork. The funded Mainnet launch simulation passed. Consult the tracker for the latest live result. [Devnet launch](https://explorer.solana.com/tx/63PeyefbM27wpHQx4eXuWtNvjnWpTxFFtUJmS5ZgRxCHC1gp8LG12Bg5ayZXU4Hj3gY3VTZ4bAoNWYbqLTHS2BJJ?cluster=devnet) · [Devnet exit](https://explorer.solana.com/tx/2LYxoQYDc2uy4cacuG5KAqzXHZbRcnbbGYZhQtaVeJ7kNsaWgm7Zhz7m49YWwAouG1jLrK8WPYWRjXhS2epN4ofF?cluster=devnet)

The commands below are a Devnet rehearsal. Inject the isolated test signer as `SOLANA_KEYPAIR_JSON` or pass `--keypair` explicitly. Set `$positionFile` to an unused absolute path under an existing private directory.

```powershell
$uri = 'https://gateway.pinata.cloud/ipfs/QmTuitgTHHDYZSBFksz7Tz4APsA3WqE8YsK3vWGfajTm8h'
$pump = @('--network','devnet','--target','pump','--name','Coiner Test Fixture','--symbol','CNTST','--metadata-uri',$uri,'--initial-buy-sol','0.02','--max-spend-sol','0.15')
pnpm cli create @pump --simulate --json
pnpm cli create @pump --position-file $positionFile --auto-exit --timeout 0.01 --poll-ms 200 --json
pnpm cli watch --network devnet --position-file $positionFile --json
```

Use `--rpc http://127.0.0.1:18999` for the local Devnet fork. The create command with `--auto-exit` broadcasts on the selected Devnet endpoint. The watch command resumes the signed bytes and saved policy. Add `--liquidate-now` to `watch` for an authorized full exit. Never create again to recover an existing launch. The watcher waits for the canonical PumpSwap pool after curve completion and carries the remaining position forward if the wait ends first.

The watcher compares the first executable exit quote to later size-normalized quotes. With the default settings, TP1 attempts to sell half the original position at 2.0x, TP2 attempts to sell a quarter at 3.5x after TP1, and a timeout or 0.70x stop attempts the full remaining exit. The timeout is independent of the price multiplier. A trigger or a quote gives no guarantee of a fill, cost recovery or future demand. Use simulated fees and actual finalized receipts, including rent and slippage. See the [watcher specification](PRD.md#10-automated-exit-engine).

## Measure net SOL

Use one ledger row per opportunity and a stable run ID. Record the rule version, eligibility, decision time, selected or skipped reason, candidate and metadata, signer, quote and fee assumptions, budget, signatures, amounts, proceeds, actual costs and disposition. Keep rejected, failed, expired, unfilled and unresolved entries. Reconcile these separately from confirmed closed trades.

- **Trading net SOL** is the sum of finalized wallet changes attributable to executing the run, including launch, bought tokens paid for in SOL, sale proceeds, rent, rent recovered, and network fees. Include any attributable WSOL balance change exactly once. Subtract separately incurred funding transaction fees and off-chain costs at their recorded SOL equivalent. Treat deposits and transfers between your own accounts as capital movements. Attribute fees already embedded in wallet deltas once.
- **Total net SOL** adds creator fees only when actually credited or claimed and reconciled. Report the result with and without creator fees. Accrued but unclaimed balances and unsold positions stay separate. Show live exposure and conservative executable exit value, including zero recovery for a position with no confirmed viable exit when stress-testing.
- **Results by attempt** include every attempted launch, including failed attempts that paid fees. Report total and mean net SOL per attempt, count of attempts, unresolved exposure, net return by time window, and maximum drawdown of the entire trial bankroll. Keep skipped opportunities available to audit selection. A portfolio of trades that is profitable on average can still contain losing periods.

The Devnet receipt sums to `-28,501,399 + 18,625,868 = -9,875,531` lamports of test SOL. The launch and exit worked. Selling 25% or 33% at 2x only returns 50% or 66% of the baseline value before additional costs. Selling 50% at 2x reaches the baseline value, which can differ from the initial buy plus rent and fees. [Receipt tracker](https://md.codev.id/#/OPERATIONS/PROJECTS/COINER_SCOUT_PRODUCTION_CLOSURE.md)

## Validate before repeating

1. **Fix the plan before collecting outcomes.** Specify the candidate filter, strategy version, entry and exit rules, cost model, sample window and review cadence. The operator sets total spend, maximum drawdown and attempt limits before any live batch. A fixed bankroll target or a balance milestone provides no signal to increase exposure.
2. **Replay complete chronological data without hindsight.** Use all candidates eligible at the historical decision time, including those that never migrated or had no viable exit. Compare the strategy with the same sample using a simpler exit rule and a no-launch baseline. Stress worse fills, delays, extra fees and no liquidity. Trades on other tokens can exercise the model. They cannot supply demand evidence for a coin that Coiner has yet to create.
3. **Run a forward paper comparison and reassess.** Keep live observations and paper fills labeled separately. Preserve an untouched chronological evaluation window. Report sample size, mean, variation and downside under the fixed rules. Compare multiple market periods to identify concentration in one winning period. Use paired, time-blocked uncertainty estimates if the sample supports them. Treat sparse or inconclusive evidence as an open research question.
4. **Validate with separately authorized live receipts.** One live trial qualifies execution. Consider repeat deployment only within an explicitly authorized risk envelope and when chronological net results support a positive average after conservative costs, with no breached risk limits or unresolved receipts. Stop opening positions on a breach, an execution discrepancy, or deterioration in rolling net performance. Reconcile and review before any new authorization. Scale decisions require further out-of-sample evidence.

Current verdict is **execution verified on Devnet, Mainnet launch simulated, and positive Mainnet expectancy unproven**. The tracker carries the next decision and the finalized evidence.
