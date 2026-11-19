import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import { NATIVE_MINT } from '@solana/spl-token';
import { PUMP_AMM_PROGRAM_ID } from '@pump-fun/pump-swap-sdk';
import { readDirectPumpSwapFill } from '../src/lib/scoutPumpFlow.js';

const address = () => Keypair.generate().publicKey;
const wallet = address();
const poolAddress = address();
const pool = { baseMint: address(), poolBaseTokenAccount: address(), poolQuoteTokenAccount: address() };

function fixture(name, tokenBefore, tokenAfter, quoteBefore, quoteAfter) {
  const accountKeys = [wallet, poolAddress, address(), pool.baseMint, NATIVE_MINT,
    address(), address(), pool.poolBaseTokenAccount, pool.poolQuoteTokenAccount, PUMP_AMM_PROGRAM_ID].map((key) => key.toBase58());
  const data = bs58.encode(createHash('sha256').update('global:' + name).digest().subarray(0, 8));
  const message = { accountKeys, header: { numRequiredSignatures: 1 },
    instructions: [{ programIdIndex: 9, accounts: [1, 0, 2, 3, 4, 5, 6, 7, 8], data }] };
  const balance = (accountIndex, mint, owner, amount) => ({
    accountIndex, mint: mint.toBase58(), owner: owner.toBase58(), uiTokenAmount: { amount: String(amount) },
  });
  return {
    version: 1,
    transaction: { message },
    meta: { err: null,
      preTokenBalances: [balance(5, pool.baseMint, wallet, tokenBefore), balance(8, NATIVE_MINT, poolAddress, quoteBefore)],
      postTokenBalances: [balance(5, pool.baseMint, wallet, tokenAfter), balance(8, NATIVE_MINT, poolAddress, quoteAfter)],
    },
  };
}

test('identifies a direct, signed v1 PumpSwap buy and sell from finalized account deltas', () => {
  assert.deepEqual(readDirectPumpSwapFill(fixture('buy_v2', 0, 10, 100, 150), poolAddress, pool),
    { side: 'buy', wallet: wallet.toBase58(), quoteDelta: 50n });
  assert.deepEqual(readDirectPumpSwapFill(fixture('sell_v2', 10, 0, 150, 103), poolAddress, pool),
    { side: 'sell', wallet: wallet.toBase58(), quoteDelta: -47n });
});

test('rejects failed, unsigned, unrelated, inconsistent and ambiguous receipt activity', () => {
  const poisons = [
    (receipt) => { receipt.meta.err = { InstructionError: [0, 1] }; },
    (receipt) => { receipt.transaction.message.header.numRequiredSignatures = 0; },
    (receipt) => { receipt.transaction.message.accountKeys[1] = address().toBase58(); },
    (receipt) => { receipt.meta.postTokenBalances[1].uiTokenAmount.amount = '99'; },
    (receipt) => { receipt.meta.postTokenBalances[0].owner = address().toBase58(); },
    (receipt) => { receipt.transaction.message.instructions.push({ programIdIndex: 3, accounts: [8], data: '' }); },
  ];
  for (const mutate of poisons) {
    const receipt = fixture('buy', 0, 10, 100, 150);
    mutate(receipt);
    assert.equal(readDirectPumpSwapFill(receipt, poolAddress, pool), null);
  }
});
