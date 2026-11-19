import assert from 'node:assert/strict';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import bs58 from 'bs58';
import BN from 'bn.js';
import {
  Connection, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction,
} from '@solana/web3.js';
import {
  NATIVE_MINT, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import { OnlinePumpSdk, PUMP_SDK } from '@pump-fun/pump-sdk';
import { canonicalPumpPoolPda } from '@pump-fun/pump-swap-sdk';
import { run } from '../bin/coiner-cli.js';
import {
  openPumpPosition, preparePumpTransaction, reconcilePumpTransaction, withWalletLock,
} from '../src/lib/pumpPosition.js';
import { settlePumpPosition } from '../src/lib/pumpLifecycle.js';

const DEVNET = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

test('an uncertain send resubmits only the original signed transaction', async () => {
  const payer = Keypair.generate();
  const owner = payer.publicKey.toBase58();
  const blockhash = Keypair.generate().publicKey.toBase58();
  const tx = new VersionedTransaction(new TransactionMessage({
    payerKey: payer.publicKey, recentBlockhash: blockhash,
    instructions: [SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: PublicKey.default, lamports: 1 })],
  }).compileToV0Message());
  tx.sign([payer]);
  const bytes = Buffer.from(tx.serialize());
  const signature = bs58.encode(tx.signatures[0]);
  const pending = { bytes: bytes.toString('base64'), signature, blockhash, lastValidBlockHeight: 10 };
  const sends = [];
  let finalized = false;
  const connection = {
    getSignatureStatuses: async signatures => {
      assert.deepEqual(signatures, [signature]);
      return { value: [finalized ? { confirmationStatus: 'finalized', err: null } : null] };
    },
    getBlockHeight: async () => 2,
    sendRawTransaction: async raw => {
      sends.push(Buffer.from(raw));
      throw new Error('timeout after acceptance');
    },
    getTransaction: async () => ({ meta: { err: null } }),
  };
  assert.equal((await reconcilePumpTransaction(connection, pending, owner, { rounds: 5, pause: async () => {} })).kind, 'pending');
  assert.equal(sends.length, 2);
  assert.deepEqual(sends, [bytes, bytes]);
  finalized = true;
  assert.equal((await reconcilePumpTransaction(connection, pending, owner)).kind, 'confirmed');
  assert.equal(sends.length, 2);

  const mint = Keypair.generate().publicKey.toBase58();
  const state = { owner, mint, remaining: '42', pending: { ...pending, action: 'liquidate' } };
  const journal = { state, save: async changes => Object.assign(state, changes) };
  const failed = {
    ...connection,
    getSignatureStatuses: async () => ({ value: [{ confirmationStatus: 'finalized', err: 'test failure' }] }),
  };
  assert.equal(await settlePumpPosition(failed, journal), 'failed');
  assert.equal(state.pending, null);
  assert.equal(state.terminal, undefined);
  assert.equal(state.remaining, '42');
  assert.equal(state.lastFailure.signature, signature);

  state.pending = { ...pending, action: 'launch', requiresPosition: true, baseAta: PublicKey.default.toBase58() };
  const missingTokenReceipt = {
    ...connection,
    getTransaction: async () => ({
      transaction: { message: tx.message },
      meta: { preBalances: [100], postBalances: [95], fee: 5, err: null },
    }),
  };
  await assert.rejects(settlePumpPosition(missingTokenReceipt, journal), /does not match the authorized action/);
  assert.equal(state.pending.signature, signature);
});

test('a nested wallet session fails and a restarted session reads the persisted journal', async () => {
  const owner = Keypair.generate().publicKey.toBase58();
  const directory = await mkdtemp(join(tmpdir(), 'coiner-pump-position-'));
  const position = join(directory, 'position.json');
  try {
    await withWalletLock(DEVNET, owner, async () => {
      const journal = await openPumpPosition(position, { genesis: DEVNET, owner }, async () => ({ receipts: [] }));
      await journal.save({ remaining: '42' });
      await assert.rejects(withWalletLock(DEVNET, owner, () => assert.fail('Nested lock acquired')), /running Coiner session/);
    });
    await withWalletLock(DEVNET, owner, async () => {
      const { state } = await openPumpPosition(position, { genesis: DEVNET, owner });
      assert.equal(state.remaining, '42');
    });
  } finally {
    await rm(position, { force: true });
    await rmdir(directory);
  }
});

const localRpc = process.env.COINER_SURFNET_RPC;

test('funded SPL simulation and Pump launch and liquidation on a loopback Devnet fork', {
  skip: !localRpc, timeout: 240000,
}, async () => {
  assert.match(localRpc, /^http:\/\/127\.0\.0\.1:\d+\/?$/);
  const connection = new Connection(localRpc, 'confirmed');
  assert.equal(await connection.getGenesisHash(), DEVNET);
  const payer = Keypair.generate();
  const graduateBuyer = Keypair.generate();
  const fund = async (signer, lamports) => {
    await connection.requestAirdrop(signer.publicKey, lamports);
    for (let i = 0; i < 20 && await connection.getBalance(signer.publicKey) < lamports; i++) await delay(300);
    assert.equal(await connection.getBalance(signer.publicKey), lamports);
  };
  await fund(payer, 2e9);
  await fund(graduateBuyer, 200e9);
  const directory = await mkdtemp(join(tmpdir(), 'coiner-pump-integration-'));
  const files = ['curve.json', 'pool.json', 'auto.json'].map(name => join(directory, name));
  const common = ['--network', 'devnet', '--rpc', localRpc, '--json', '--priority', 'normal'];
  const meta = [
    '--name', 'Coiner Test Fixture', '--symbol', 'CNTST',
    '--metadata-uri', 'https://gateway.pinata.cloud/ipfs/QmTuitgTHHDYZSBFksz7Tz4APsA3WqE8YsK3vWGfajTm8h',
  ];
  const pump = ['--target', 'pump', '--initial-buy-sol', '0.02', '--max-spend-sol', '0.15'];
  async function cli(args, expectedExit = 0) {
    const logs = [];
    const log = console.log;
    const error = console.error;
    const previousExitCode = process.exitCode;
    process.exitCode = 0;
    process.env.SOLANA_KEYPAIR_JSON = JSON.stringify(Array.from(payer.secretKey));
    try {
      console.log = data => logs.push(String(data));
      console.error = data => logs.push(String(data));
      await run([...args, ...common]);
      assert.equal(process.exitCode, expectedExit, logs.join('\n'));
      return JSON.parse(logs.at(-1));
    } finally {
      delete process.env.SOLANA_KEYPAIR_JSON;
      console.log = log;
      console.error = error;
      process.exitCode = previousExitCode;
    }
  }
  const launch = file => cli(['create', ...meta, ...pump, '--position-file', file]);
  const liquidate = file => cli(['watch', '--position-file', file, '--liquidate-now']);
  try {
    const spl = await cli(['create', ...meta, '--simulate']);
    assert.equal(spl.error, null);
    assert.ok(spl.unitsConsumed > 0);
    assert.equal(await connection.getAccountInfo(new PublicKey(spl.mint)), null);
    const dryPump = await cli(['create', ...meta, ...pump, '--simulate']);
    assert.equal(await connection.getAccountInfo(new PublicKey(dryPump.mint)), null);
    const curve = await launch(files[0]);
    assert.equal(curve.status, 'created');
    assert.ok(BigInt(curve.remainingBaseTokens) > 0n);
    const duplicateLaunch = await cli([
      'create', ...meta, ...pump, '--position-file', files[0], '--auto-exit',
    ], 1);
    assert.match(duplicateLaunch.error, /position file already exists/);
    const exit = await liquidate(files[0]);
    assert.equal(exit.status, 'liquidated');
    assert.equal(exit.receipts[1].venue, 'curve');
    assert.equal(exit.receipts[1].baseTokenDelta, '-' + curve.remainingBaseTokens);
    assert.ok(BigInt(exit.receipts[1].walletLamportDelta) > 0n);
    assert.deepEqual((await liquidate(files[0])).receipts, exit.receipts);

    const automatic = await cli([
      'create', ...meta, ...pump, '--position-file', files[2], '--auto-exit', '--timeout', '0.01', '--poll-ms', '200',
    ]);
    assert.equal(automatic.status, 'liquidated');
    assert.deepEqual(automatic.receipts.map(receipt => receipt.action), ['launch', 'liquidate']);

    const migrating = await launch(files[1]);
    const mint = new PublicKey(migrating.mint);
    const online = new OnlinePumpSdk(connection);
    const curveBefore = await online.fetchBondingCurve(mint);
    const buyer = graduateBuyer.publicKey;
    const buyerAta = getAssociatedTokenAddressSync(mint, buyer, false, TOKEN_2022_PROGRAM_ID);
    const buy = await PUMP_SDK.getBuyV3InstructionRaw({
      user: buyer, mint, amount: curveBefore.realTokenReserves, quoteAmount: new BN('150000000000'),
    });
    async function sendFixture(instructions) {
      const prepared = await preparePumpTransaction(connection, graduateBuyer, instructions, { priority: 50000 });
      const result = await reconcilePumpTransaction(connection, prepared, buyer.toBase58());
      assert.equal(result.kind, 'confirmed');
    }
    await sendFixture([
      createAssociatedTokenAccountIdempotentInstruction(buyer, buyerAta, buyer, mint, TOKEN_2022_PROGRAM_ID), buy,
    ]);
    assert.equal((await online.fetchBondingCurve(mint)).complete, true);
    const global = await online.fetchGlobal();
    await sendFixture([await PUMP_SDK.migrateV2Instruction({
      withdrawAuthority: global.withdrawAuthority, mint, user: buyer, quoteMint: NATIVE_MINT,
    })]);
    assert.ok(await connection.getAccountInfo(canonicalPumpPoolPda(mint)));
    const poolExit = await liquidate(files[1]);
    assert.equal(poolExit.status, 'liquidated');
    assert.equal(poolExit.receipts[1].venue, 'pumpswap');
    assert.equal(poolExit.receipts[1].baseTokenDelta, '-' + migrating.remainingBaseTokens);
    assert.ok(BigInt(poolExit.receipts[1].walletLamportDelta) > 0n);
  } finally {
    for (const file of files) await rm(file, { force: true });
    await rmdir(directory);
  }
});
