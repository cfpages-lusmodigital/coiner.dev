import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ComputeBudgetProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const GENESIS = {
  devnet: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  'mainnet-beta': '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  testnet: '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY',
};

export async function verifySolanaCluster(connection, network) {
  const genesis = await connection.getGenesisHash();
  if (GENESIS[network] !== genesis) throw new Error('The Solana RPC does not match the requested cluster.');
  return genesis;
}

// The OS releases the listener after a crash, including on Windows.
export async function withWalletLock(genesis, owner, work) {
  const digest = createHash('sha256').update(genesis + ':' + owner).digest();
  const port = 49152 + digest.readUInt16BE() % 16384;
  const server = net.createServer(socket => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ port, host: '127.0.0.1', exclusive: true }, resolve);
  }).catch(error => {
    if (error.code === 'EADDRINUSE') throw new Error('The wallet already has a running Coiner session or its local lock port is occupied.');
    throw error;
  });
  try {
    return await work();
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

export async function openPumpPosition(filename, identity, initial) {
  const requested = path.resolve(filename);
  const directory = await fs.realpath(path.dirname(requested));
  const file = path.join(directory, path.basename(requested));
  let state;
  let created = false;
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 128 * 1024) {
      throw new Error('Expected a private regular Coiner position file.');
    }
    state = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT' || !initial) throw error;
    state = { version: 1, ...identity, ...await initial() };
    const handle = await fs.open(file, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(state));
      await handle.sync();
    } finally {
      await handle.close();
    }
    created = true;
  }
  if (state.version !== 1 || state.genesis !== identity.genesis || state.owner !== identity.owner) {
    throw new Error('Position file belongs to a different cluster or wallet.');
  }
  return {
    state, created,
    async save(changes) {
      const next = { ...state, ...changes };
      const temporary = path.join(directory, '.' + path.basename(file) + '.' + randomUUID());
      const handle = await fs.open(temporary, 'wx', 0o600);
      try {
        try {
          await handle.writeFile(JSON.stringify(next));
          await handle.sync();
        } finally {
          await handle.close();
        }
        await fs.rename(temporary, file);
        Object.assign(state, changes);
      } finally {
        await fs.rm(temporary, { force: true });
      }
    },
  };
}

export async function preparePumpTransaction(connection, payer, instructions, options) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: options.priority }),
      ...instructions,
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign(options.mintSigner ? [payer, options.mintSigner] : [payer]);
  let bytes;
  try {
    bytes = Buffer.from(tx.serialize());
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
  if (!bytes || bytes.length > 1232) throw new Error('The Pump transaction exceeds Solana’s packet size. Shorten the metadata URI.');
  const payerAddress = payer.publicKey.toBase58();
  const before = options.maxSpend === undefined ? undefined : await connection.getBalanceAndContext(payer.publicKey);
  const response = await connection.simulateTransaction(tx, {
    commitment: 'confirmed',
    sigVerify: true,
    accounts: { encoding: 'base64', addresses: [payerAddress] },
    ...(before && { minContextSlot: before.context.slot }),
  });
  if (response.value.err) {
    throw new Error('Pump transaction simulation failed: ' + JSON.stringify(response.value.err));
  }
  if (before) {
    const balance = await connection.getBalance(payer.publicKey, {
      commitment: 'confirmed', minContextSlot: response.context.slot,
    });
    const after = response.value.accounts?.[0]?.lamports;
    if (!Number.isSafeInteger(before.value) || balance !== before.value || !Number.isSafeInteger(after) ||
      BigInt(before.value) - BigInt(after) > options.maxSpend) {
      throw new Error('Simulated wallet debit could not be verified within --max-spend-sol.');
    }
  }
  return {
    signature: bs58.encode(tx.signatures[0]),
    bytes: bytes.toString('base64'),
    blockhash,
    lastValidBlockHeight,
  };
}

export async function reconcilePumpTransaction(connection, pending, owner, { rounds = 36, pause = delay } = {}) {
  const bytes = Buffer.from(pending.bytes, 'base64');
  const tx = VersionedTransaction.deserialize(bytes);
  if (tx.message.staticAccountKeys[0].toBase58() !== owner ||
    tx.message.recentBlockhash !== pending.blockhash || bs58.encode(tx.signatures[0]) !== pending.signature) {
    throw new Error('Pending transaction identity does not match the journal.');
  }
  for (let round = 0; round < rounds; round++) {
    let [status] = (await connection.getSignatureStatuses([pending.signature], {
      searchTransactionHistory: true,
    })).value;
    if (!status && await connection.getBlockHeight('finalized') > pending.lastValidBlockHeight) {
      [status] = (await connection.getSignatureStatuses([pending.signature], {
        searchTransactionHistory: true,
      })).value;
      if (!status) return { kind: 'expired' };
    }
    if (status?.confirmationStatus === 'finalized') {
      if (status.err) return { kind: 'failed', error: status.err };
      const transaction = await connection.getTransaction(pending.signature, {
        commitment: 'finalized', maxSupportedTransactionVersion: 0,
      });
      if (transaction?.meta) return { kind: 'confirmed', transaction };
    }
    if (!status && round % 4 === 0) {
      // A timeout can occur after acceptance. Only these exact bytes may be resent.
      await connection.sendRawTransaction(bytes, {
        maxRetries: 0, skipPreflight: false, preflightCommitment: 'confirmed',
      }).catch(() => {});
    }
    await pause(1000);
  }
  return { kind: 'pending' };
}

export function pumpTransactionDeltas(transaction, owner, mint, baseAta, quoteAta) {
  const { message } = transaction.transaction;
  const keys = message.getAccountKeys({ accountKeysFromLookups: transaction.meta.loadedAddresses });
  const { meta } = transaction;
  if (meta.err || keys.get(0)?.toBase58() !== owner) throw new Error('Finalized receipt has an unexpected payer or error.');
  let baseIndex;
  let quoteIndex;
  for (let i = 0; i < keys.length; i++) {
    if (keys.get(i)?.equals(baseAta)) baseIndex = i;
    if (keys.get(i)?.equals(quoteAta)) quoteIndex = i;
  }
  function baseBalance(balances) {
    const entry = balances?.find(item => item.accountIndex === baseIndex);
    if (!entry) return 0n;
    if (entry.mint !== mint || (entry.owner && entry.owner !== owner)) {
      throw new Error('Finalized receipt has an unexpected token balance identity.');
    }
    return BigInt(entry.uiTokenAmount.amount);
  }
  function lamportDelta(index) {
    if (index === undefined) return 0n;
    const before = meta.preBalances[index];
    const after = meta.postBalances[index];
    if (!Number.isSafeInteger(before) || !Number.isSafeInteger(after)) {
      throw new Error('Finalized receipt contains an invalid lamport balance.');
    }
    return BigInt(after) - BigInt(before);
  }
  return {
    baseDelta: baseBalance(meta.postTokenBalances) - baseBalance(meta.preTokenBalances),
    walletDelta: lamportDelta(0) + lamportDelta(quoteIndex),
    fee: BigInt(meta.fee),
  };
}
