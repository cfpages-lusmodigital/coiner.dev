import { setTimeout as delay } from 'node:timers/promises';
import BN from 'bn.js';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  NATIVE_MINT, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  unpackAccount, unpackMint,
} from '@solana/spl-token';
import {
  PUMP_PROGRAM_ID, PUMP_SDK, OnlinePumpSdk, bondingCurvePda,
  getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount,
} from '@pump-fun/pump-sdk';
import {
  PUMP_AMM_PROGRAM_ID, PUMP_AMM_SDK, OnlinePumpAmmSdk, canonicalPumpPoolPda, sellBaseInput,
} from '@pump-fun/pump-swap-sdk';
import {
  openPumpPosition, preparePumpTransaction, pumpTransactionDeltas, reconcilePumpTransaction,
  verifySolanaCluster, withWalletLock,
} from './pumpPosition.js';

const asBN = value => new BN(value.toString());
const min = (a, b) => a < b ? a : b;

export async function pumpVenue(connection, mint, user) {
  const curveAddress = bondingCurvePda(mint);
  const [curveInfo, mintInfo] = await connection.getMultipleAccountsInfo([curveAddress, mint]);
  if (!curveInfo?.owner.equals(PUMP_PROGRAM_ID) || !mintInfo ||
    ![TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID].some(program => mintInfo.owner.equals(program))) {
    throw new Error('Expected a Pump bonding curve and an SPL mint.');
  }
  const tokenProgram = mintInfo.owner;
  const mintAccount = unpackMint(mint, mintInfo, tokenProgram);
  const curve = PUMP_SDK.decodeBondingCurve(curveInfo);
  if (!curve.quoteMint.equals(PublicKey.default) && !curve.quoteMint.equals(NATIVE_MINT)) {
    throw new Error('Coiner supports SOL-quoted Pump positions.');
  }
  const baseAta = getAssociatedTokenAddressSync(mint, user, false, tokenProgram);
  const quoteAta = getAssociatedTokenAddressSync(NATIVE_MINT, user);
  const tokenInfo = await connection.getAccountInfo(baseAta);
  const liveBalance = tokenInfo ? unpackAccount(baseAta, tokenInfo, tokenProgram) : null;
  if (liveBalance && (!liveBalance.owner.equals(user) || !liveBalance.mint.equals(mint))) {
    throw new Error('Token account does not belong to this position.');
  }
  const balance = liveBalance?.amount ?? 0n;
  if (curve.complete) {
    const pool = canonicalPumpPoolPda(mint);
    const poolInfo = await connection.getAccountInfo(pool);
    if (!poolInfo) return { balance, venue: 'awaiting-migration' };
    if (!poolInfo.owner.equals(PUMP_AMM_PROGRAM_ID)) throw new Error('Unexpected canonical PumpSwap pool owner.');
    const swap = await new OnlinePumpAmmSdk(connection).swapSolanaState(pool, user, baseAta, quoteAta);
    if (!swap.pool.baseMint.equals(mint) || !swap.pool.quoteMint.equals(NATIVE_MINT)) {
      throw new Error('Canonical PumpSwap pool does not match the position.');
    }
    return {
      balance, baseAta, quoteAta, venue: 'pumpswap',
      quote: (amount, slippage) => sellBaseInput({
        base: asBN(amount), slippage, baseReserve: swap.poolBaseAmount, quoteReserve: swap.poolQuoteAmount,
        virtualQuoteReserves: swap.pool.virtualQuoteReserves,
        feeBucketsTotal: swap.pool.protocolFees.add(swap.pool.creatorFees),
        baseMintAccount: swap.baseMintAccount, baseMint: mint, coinCreator: swap.pool.coinCreator,
        creator: swap.pool.creator, feeConfig: swap.feeConfig, globalConfig: swap.globalConfig,
        quoteMint: NATIVE_MINT, isMayhemMode: swap.pool.isMayhemMode, creatorFeeBps: swap.pool.creatorFeeBps,
      }).minQuote,
      instructions: (amount, slippage) => PUMP_AMM_SDK.sellBaseInput(swap, asBN(amount), slippage, { v2: true }),
    };
  }
  const online = new OnlinePumpSdk(connection);
  const [global, feeConfig] = await Promise.all([online.fetchGlobal(), online.fetchFeeConfig()]);
  function quote(amount) {
    return getSellSolAmountFromTokenAmount({
      global, feeConfig, mintSupply: asBN(mintAccount.supply), bondingCurve: curve, amount: asBN(amount),
    });
  }
  return {
    balance, baseAta, quoteAta, venue: 'curve',
    quote: (amount, slippage) => quote(amount).muln(10000 - Math.ceil(slippage * 100)).divn(10000),
    instructions: (amount, slippage) => PUMP_SDK.sellV2Instructions({
      global, bondingCurveAccountInfo: curveInfo, bondingCurve: curve, mint, user,
      amount: asBN(amount), quoteAmount: quote(amount), slippage, tokenProgram,
    }),
  };
}

async function launchInstructions(connection, { payer, mintSigner, name, symbol, uri, buyLamports }) {
  const user = payer.publicKey;
  const mint = mintSigner.publicKey;
  const create = { mint, user, creator: user, name, symbol, uri, mayhemMode: false };
  if (buyLamports === 0n) return [await PUMP_SDK.createV2Instruction(create)];
  const online = new OnlinePumpSdk(connection);
  const [global, feeConfig] = await Promise.all([online.fetchGlobal(), online.fetchFeeConfig()]);
  const budget = asBN(buyLamports);
  const amount = getBuyTokenAmountFromSolAmount({
    global, feeConfig, amount: budget.muln(99).divn(100), mintSupply: null, bondingCurve: null, quoteMint: NATIVE_MINT,
  });
  if (amount.isZero()) throw new Error('The initial buy budget is too small.');
  const baseAta = getAssociatedTokenAddressSync(mint, user, false, TOKEN_2022_PROGRAM_ID);
  return [
    await PUMP_SDK.createV2Instruction(create),
    createAssociatedTokenAccountIdempotentInstruction(user, baseAta, user, mint, TOKEN_2022_PROGRAM_ID),
    await PUMP_SDK.getBuyV3InstructionRaw({ user, mint, amount, quoteAmount: budget }),
  ];
}

function receiptSummary(state, stateName) {
  return {
    success: ['created', 'liquidated', 'simulated'].includes(stateName),
    status: stateName,
    mint: state.mint,
    pendingSignature: state.pending?.signature,
    lastFailure: state.lastFailure,
    remainingBaseTokens: state.remaining,
    receipts: state.receipts,
  };
}

export async function settlePumpPosition(connection, journal) {
  const { state, save } = journal;
  const { pending } = state;
  const result = await reconcilePumpTransaction(connection, pending, state.owner);
  if (result.kind === 'pending') return 'pending';
  if (result.kind !== 'confirmed') {
    await save({
      pending: null,
      lastFailure: { action: pending.action, signature: pending.signature, status: result.kind },
      ...(pending.action === 'launch' && { terminal: result.kind }),
    });
    return result.kind;
  }
  const owner = new PublicKey(state.owner);
  const baseAta = new PublicKey(pending.baseAta);
  const quoteAta = getAssociatedTokenAddressSync(NATIVE_MINT, owner);
  const deltas = pumpTransactionDeltas(result.transaction, state.owner, state.mint, baseAta, quoteAta);
  const remaining = BigInt(state.remaining);
  const sold = -deltas.baseDelta;
  const mismatch = pending.action === 'launch'
    ? deltas.baseDelta < 0n || (pending.requiresPosition && deltas.baseDelta === 0n)
    : sold !== BigInt(pending.amount) || sold > remaining;
  if (mismatch) {
    throw new Error('Finalized token balance does not match the authorized action.');
  }
  const receipt = {
    action: pending.action, venue: pending.venue, signature: pending.signature,
    slot: result.transaction.slot, baseTokenDelta: deltas.baseDelta.toString(),
    walletLamportDelta: deltas.walletDelta.toString(), networkFeeLamports: deltas.fee.toString(),
  };
  await save({
    pending: null, receipts: [...state.receipts, receipt],
    ...(pending.action === 'launch'
      ? { initial: deltas.baseDelta.toString(), remaining: deltas.baseDelta.toString() }
      : { remaining: (remaining - sold).toString() }),
  });
  return 'confirmed';
}

export async function runPumpLifecycle(connection, {
  payer, network, positionFile, launch, mint: requestedMint, autoExit = false,
  simulate = false, liquidateNow = false, priority, settings,
}) {
  if (network === 'testnet') throw new Error('Pump positions require Devnet or Mainnet.');
  const genesis = await verifySolanaCluster(connection, network);
  const owner = payer.publicKey.toBase58();
  if (simulate) {
    if (!launch) throw new Error('A Pump launch is required for this simulation.');
    const mintSigner = Keypair.generate();
    const instructions = await launchInstructions(connection, { ...launch, payer, mintSigner, uri: await launch.uri() });
    const prepared = await preparePumpTransaction(connection, payer, instructions, {
      priority, mintSigner, maxSpend: launch.maxSpend,
    });
    return { ...receiptSummary({ mint: mintSigner.publicKey.toBase58(), receipts: [] }, 'simulated'), simulatedSignature: prepared.signature };
  }
  return withWalletLock(genesis, owner, async () => {
    let initial;
    if (launch) {
      initial = async () => {
        const mintSigner = Keypair.generate();
        const instructions = await launchInstructions(connection, { ...launch, payer, mintSigner, uri: await launch.uri() });
        const prepared = await preparePumpTransaction(connection, payer, instructions, {
          priority, mintSigner, maxSpend: launch.maxSpend,
        });
        const baseAta = getAssociatedTokenAddressSync(mintSigner.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
        return {
          mint: mintSigner.publicKey.toBase58(),
          initial: '0', remaining: '0', autoExit, settings, receipts: [],
          pending: {
            ...prepared, action: 'launch', venue: 'curve', baseAta: baseAta.toBase58(),
            requiresPosition: launch.buyLamports > 0n,
          },
        };
      };
    } else if (requestedMint) {
      initial = async () => {
        const venue = await pumpVenue(connection, requestedMint, payer.publicKey);
        if (venue.balance === 0n) throw new Error('Wallet has no tokens in the requested Pump position.');
        return {
          mint: requestedMint.toBase58(), initial: venue.balance.toString(),
          remaining: venue.balance.toString(), autoExit: true, settings, receipts: [],
        };
      };
    }
    const journal = await openPumpPosition(positionFile, { genesis, owner }, initial);
    const { state, save } = journal;
    if (launch && !journal.created) throw new Error('The position file already exists. Use watch to resume it or choose a new file to launch.');
    if (requestedMint && state.mint !== requestedMint.toBase58()) throw new Error('Mint does not match the position file.');
    if (state.terminal) return receiptSummary(state, state.terminal);
    if (state.pending) {
      const outcome = await settlePumpPosition(connection, journal);
      if (outcome !== 'confirmed') return receiptSummary(state, outcome);
    }
    if (launch && !state.receipts.some(receipt => receipt.action === 'launch')) {
      throw new Error('The position file has no recoverable launch. Use a new file for a new launch.');
    }
    if (launch && !state.autoExit && !liquidateNow) return receiptSummary(state, 'created');
    const mint = new PublicKey(state.mint);
    const policy = state.settings;
    if (!state.startedAt) await save({ startedAt: Date.now() });
    for (let iteration = 0; iteration < policy.maxIterations; iteration++) {
      const remaining = BigInt(state.remaining);
      if (remaining === 0n) return receiptSummary(state, 'liquidated');
      const venue = await pumpVenue(connection, mint, payer.publicKey);
      if (venue.balance < remaining) throw new Error('Tracked tokens are missing from the wallet. Reconcile the position before resuming.');
      if (venue.venue === 'awaiting-migration') {
        await delay(policy.pollMs);
        continue;
      }
      const mark = BigInt(venue.quote(remaining, 0).toString());
      if (mark <= 0n) throw new Error('The current venue has no executable SOL quote.');
      if (!state.baseline) await save({ baseline: { tokens: remaining.toString(), lamports: mark.toString() } });
      const quoteRatio = mark * BigInt(state.baseline.tokens) * 10000n / (remaining * BigInt(state.baseline.lamports));
      let action;
      let amount = remaining;
      if (liquidateNow || Date.now() - state.startedAt >= policy.timeoutMs || quoteRatio <= BigInt(policy.stopLoss)) {
        action = 'liquidate';
      } else if (!state.receipts.some(receipt => receipt.action === 'tp1') && quoteRatio >= BigInt(policy.tp1)) {
        action = 'tp1';
        amount = min(remaining, BigInt(state.initial) / 2n);
      } else if (state.receipts.some(receipt => receipt.action === 'tp1') &&
        !state.receipts.some(receipt => receipt.action === 'tp2') && quoteRatio >= BigInt(policy.tp2)) {
        action = 'tp2';
        amount = min(remaining, BigInt(state.initial) / 4n);
      }
      if (action && amount > 0n) {
        if (venue.quote(amount, policy.slippage).isZero()) throw new Error('The sale minimum must be at least one lamport.');
        const instructions = await venue.instructions(amount, policy.slippage);
        const prepared = await preparePumpTransaction(connection, payer, instructions, { priority });
        await save({ pending: {
          ...prepared, action, amount: amount.toString(), venue: venue.venue, baseAta: venue.baseAta.toBase58(),
        } });
        const outcome = await settlePumpPosition(connection, journal);
        if (outcome !== 'confirmed') return receiptSummary(state, outcome);
        if (state.remaining === '0') return receiptSummary(state, 'liquidated');
      }
      if (iteration + 1 < policy.maxIterations) await delay(policy.pollMs);
    }
    return receiptSummary(state, 'watch-limit');
  });
}
