import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { NATIVE_MINT } from '@solana/spl-token';
import { PUMP_AMM_PROGRAM_ID, PUMP_AMM_SDK, canonicalPumpPoolPda } from '@pump-fun/pump-swap-sdk';
import { verifySolanaCluster } from './pumpPosition.js';

const poolLimit = 3;
const receiptLimit = 8;
const swaps = new Map([
  'buy', 'buy_exact_quote_in', 'buy_v2', 'buy_exact_quote_in_v2', 'sell', 'sell_v2',
].map((name) => [
  createHash('sha256').update('global:' + name).digest('hex').slice(0, 16),
  name.startsWith('buy') ? 'buy' : 'sell',
]));

function findBalance(rows, index, mint) {
  return rows?.find((row) => row.accountIndex === index && row.mint === mint.toBase58());
}

export function readDirectPumpSwapFill(receipt, poolAddress, pool) {
  if (!receipt?.meta || receipt.meta.err !== null) return null;
  const { message } = receipt.transaction;
  const keys = [...message.accountKeys, ...(receipt.meta.loadedAddresses?.writable ?? []),
    ...(receipt.meta.loadedAddresses?.readonly ?? [])];
  const calls = message.instructions.filter((ix) => keys[ix.programIdIndex] === PUMP_AMM_PROGRAM_ID.toBase58());
  if (calls.length !== 1) return null;
  const [ix] = calls;
  const [poolIndex, walletIndex, , baseIndex, quoteIndex, ownerTokenIndex, , vaultBaseIndex, vaultQuoteIndex] = ix.accounts;
  const side = swaps.get(Buffer.from(bs58.decode(ix.data)).subarray(0, 8).toString('hex'));
  const wallet = keys[walletIndex];
  if (!side || !wallet || walletIndex >= message.header.numRequiredSignatures ||
      keys[poolIndex] !== poolAddress.toBase58() || keys[baseIndex] !== pool.baseMint.toBase58() ||
      keys[quoteIndex] !== NATIVE_MINT.toBase58() || keys[vaultBaseIndex] !== pool.poolBaseTokenAccount.toBase58() ||
      keys[vaultQuoteIndex] !== pool.poolQuoteTokenAccount.toBase58()) return null;
  const touchesPosition = (op) => op.accounts.some((i) => i === vaultBaseIndex || i === vaultQuoteIndex || i === ownerTokenIndex);
  if (message.instructions.some((op) => op !== ix && touchesPosition(op)) ||
      receipt.meta.innerInstructions?.some((group) =>
        message.instructions[group.index] !== ix && group.instructions.some(touchesPosition))) return null;

  const before = (index, mint) => findBalance(receipt.meta.preTokenBalances, index, mint);
  const after = (index, mint) => findBalance(receipt.meta.postTokenBalances, index, mint);
  const vaultBefore = before(vaultQuoteIndex, NATIVE_MINT);
  const vaultAfter = after(vaultQuoteIndex, NATIVE_MINT);
  const ownedBefore = before(ownerTokenIndex, pool.baseMint);
  const ownedAfter = after(ownerTokenIndex, pool.baseMint);
  if (vaultBefore?.owner !== poolAddress.toBase58() || vaultAfter?.owner !== poolAddress.toBase58() ||
      !(ownedBefore || ownedAfter) || [ownedBefore, ownedAfter].some((row) => row && row.owner !== wallet)) return null;

  const amount = (entry) => BigInt(entry.uiTokenAmount.amount);
  const quoteDelta = amount(vaultAfter) - amount(vaultBefore);
  const tokenDelta = (ownedAfter ? amount(ownedAfter) : 0n) - (ownedBefore ? amount(ownedBefore) : 0n);
  if (side === 'buy' ? quoteDelta <= 0n || tokenDelta <= 0n : quoteDelta >= 0n || tokenDelta >= 0n) return null;
  return { side, wallet, quoteDelta };
}

async function fetchReceipts(endpoint, rows) {
  if (rows.length === 0) return new Map();
  const request = rows.map(({ signature }, id) => ({
    jsonrpc: '2.0', id, method: 'getTransaction', params: [
      signature, { commitment: 'finalized', encoding: 'json', maxSupportedTransactionVersion: 1 },
    ],
  }));
  const reply = await fetch(endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(request),
  });
  if (!reply.ok) {
    await reply.body?.cancel();
    throw new Error('Transaction batch was rejected.');
  }
  const batch = await reply.json();
  if (!Array.isArray(batch)) throw new Error('Expected a Solana transaction batch.');
  return new Map(batch.map(({ id, result }) => [id, result]));
}

async function samplePool(connection, candidate) {
  const mint = new PublicKey(candidate.address);
  const address = canonicalPumpPoolPda(mint);
  const record = { mint: candidate.address, pool: address.toBase58() };
  if (candidate.market.pairAddress !== record.pool) return { ...record, status: 'unverified-pool' };
  const info = await connection.getAccountInfo(address, 'finalized');
  if (!info?.owner.equals(PUMP_AMM_PROGRAM_ID)) return { ...record, status: 'unverified-pool' };
  const pool = PUMP_AMM_SDK.decodePool(info);
  if (!pool.baseMint.equals(mint) || !pool.quoteMint.equals(NATIVE_MINT)) return { ...record, status: 'unverified-pool' };
  const history = await connection.getSignaturesForAddress(address, { limit: receiptLimit }, 'finalized');
  const successful = history.filter((row) => row.err === null);
  const receipts = await fetchReceipts(connection.rpcEndpoint, successful).catch(() => new Map());
  const fills = [];
  let unavailable = 0;
  for (const [i, row] of successful.entries()) {
    const receipt = receipts.get(i);
    if (!receipt || receipt.slot !== row.slot || receipt.transaction?.signatures[0] !== row.signature) {
      unavailable++;
      continue;
    }
    const fill = readDirectPumpSwapFill(receipt, address, pool);
    if (fill) fills.push({
      signature: row.signature, slot: row.slot, blockTime: row.blockTime,
      side: fill.side, wallet: fill.wallet, quoteVaultDeltaLamports: fill.quoteDelta.toString(),
      knownCreator: fill.wallet === pool.coinCreator.toBase58() || fill.wallet === pool.creator.toBase58(),
    });
  }
  const peers = fills.filter((fill) => !fill.knownCreator);
  const total = peers.reduce((sum, row) => sum + BigInt(row.quoteVaultDeltaLamports), 0n);
  return {
    ...record, status: unavailable ? 'partial' : 'sampled',
    signaturesSeen: history.length, unavailable, failed: history.length - successful.length,
    unclassified: successful.length - unavailable - fills.length,
    newestSlot: history[0]?.slot ?? null, oldestSlot: history.at(-1)?.slot ?? null,
    distinctBuyerAddresses: new Set(peers.filter((row) => row.side === 'buy').map((row) => row.wallet)).size,
    distinctSellerAddresses: new Set(peers.filter((row) => row.side === 'sell').map((row) => row.wallet)).size,
    nonCreatorNetQuoteVaultLamports: total.toString(), fills,
  };
}

export async function sampleScoutPumpFlow(connection, candidates) {
  const genesis = await verifySolanaCluster(connection, 'mainnet-beta');
  const selected = candidates.filter(({ market }) => market.dexId === 'pumpswap' && market.quoteAddress === NATIVE_MINT.toBase58());
  const results = [];
  for (const candidate of selected.slice(0, poolLimit)) {
    results.push(await samplePool(connection, candidate).catch(() => ({ mint: candidate.address, status: 'unavailable' })));
  }
  return { genesis, poolLimit, receiptLimit, eligibleComparableCount: selected.length, results };
}
