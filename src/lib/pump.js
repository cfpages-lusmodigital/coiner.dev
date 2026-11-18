/**
 * pump.js — Sovereign Pump.fun Bonding Curve Engine & Automated Exit Client
 * 
 * Implements deterministic bonding curve account parsing, AMM constant-product pricing,
 * slippage protection, and atomic sell instruction construction for automated take-profit
 * and stop-loss routines. Fully compliant with modern 14-account Pump.fun IDL.
 */

import { Buffer } from 'buffer';
import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

// Canonical Pump.fun Protocol Constants (Mainnet-Beta)
export const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
export const PUMP_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
export const PUMP_FEE_PROGRAM_ID = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');

// 8-byte Anchor Discriminators
export const DISCRIMINATOR_BONDING_CURVE = Buffer.from('17b7f83760d8ac60', 'hex');
export const DISCRIMINATOR_SELL = Buffer.from('33e685a4017f83ad', 'hex');
export const DISCRIMINATOR_BUY = Buffer.from('66063d1201daebea', 'hex');
export const DISCRIMINATOR_CREATE = Buffer.from('181ec828051c0777', 'hex');

// Pump.fun Curve Parameters
export const INITIAL_VIRTUAL_SOL_RESERVES = 30_000_000_000n; // 30 SOL in lamports
export const INITIAL_VIRTUAL_TOKEN_RESERVES = 1_073_000_000_000_000n; // 1.073B tokens (6 dec)
export const TOTAL_TOKEN_SUPPLY = 1_000_000_000_000_000n; // 1B tokens (6 dec)
export const CURVE_TOKEN_ALLOCATION = 793_100_000_000_000n; // ~793.1M tokens sold on curve
export const PUMP_FEE_BPS = 100n; // 1.00% (100 basis points)

/**
 * Derives the PDA for a token's bonding curve
 */
export function getBondingCurvePDA(mintPublicKey, programId = PUMP_PROGRAM_ID) {
  const mint = typeof mintPublicKey === 'string' ? new PublicKey(mintPublicKey) : mintPublicKey;
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    programId
  );
  return { pda, bump };
}

/**
 * Derives the Associated Token Account for the bonding curve
 */
export function getBondingCurveATA(mintPublicKey, bondingCurvePda) {
  const mint = typeof mintPublicKey === 'string' ? new PublicKey(mintPublicKey) : mintPublicKey;
  const pda = typeof bondingCurvePda === 'string' ? new PublicKey(bondingCurvePda) : bondingCurvePda;
  return getAssociatedTokenAddressSync(mint, pda, true);
}

/**
 * Derives the Pump.fun Global Account PDA
 */
export function getGlobalPDA(programId = PUMP_PROGRAM_ID) {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    programId
  );
  return { pda, bump };
}

/**
 * Derives the Pump.fun Event Authority PDA
 */
export function getEventAuthorityPDA(programId = PUMP_PROGRAM_ID) {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority')],
    programId
  );
  return { pda, bump };
}

/**
 * Derives the Pump.fun Creator Vault PDA
 */
export function getCreatorVaultPDA(creatorPublicKey, programId = PUMP_PROGRAM_ID) {
  const creator = typeof creatorPublicKey === 'string' ? new PublicKey(creatorPublicKey) : creatorPublicKey;
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('creator-vault'), creator.toBuffer()],
    programId
  );
  return { pda, bump };
}

/**
 * Derives the Pump.fun Fee Config PDA
 */
export function getFeeConfigPDA(programId = PUMP_PROGRAM_ID, feeProgramId = PUMP_FEE_PROGRAM_ID) {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('fee_config'), programId.toBuffer()],
    feeProgramId
  );
  return { pda, bump };
}

/**
 * Parses raw on-chain BondingCurve account buffer (49 bytes legacy or 81+ bytes modern)
 */
export function parseBondingCurveData(dataBuffer) {
  if (!dataBuffer || dataBuffer.length < 49) {
    throw new Error(`Invalid bonding curve buffer length: expected >= 49 bytes, got ${dataBuffer?.length || 0}`);
  }

  const buf = Buffer.from(dataBuffer);
  const discriminator = buf.subarray(0, 8);
  if (!discriminator.equals(DISCRIMINATOR_BONDING_CURVE)) {
    throw new Error(
      `Invalid bonding curve discriminator: expected ${DISCRIMINATOR_BONDING_CURVE.toString('hex')}, got ${discriminator.toString('hex')}`
    );
  }

  const virtualTokenReserves = buf.readBigUInt64LE(8);
  const virtualSolReserves = buf.readBigUInt64LE(16);
  const realTokenReserves = buf.readBigUInt64LE(24);
  const realSolReserves = buf.readBigUInt64LE(32);
  const tokenTotalSupply = buf.readBigUInt64LE(40);
  const complete = buf.readUInt8(48) !== 0;

  // Modern Pump.fun layout: creator address stored at bytes 49..81 (32 bytes)
  let creator = null;
  if (buf.length >= 81) {
    creator = new PublicKey(buf.subarray(49, 81));
  }

  // Spot price: (virtualSolReserves / 1e9) / (virtualTokenReserves / 1e6) = SOL per whole token
  const vSol = Number(virtualSolReserves);
  const vToken = Number(virtualTokenReserves);
  const spotPriceSolPerToken = vToken > 0 ? (vSol / 1e9) / (vToken / 1e6) : 0;

  // Progress percentage (0% to 100% of the 793.1M tokens allocated to curve)
  const soldTokens = CURVE_TOKEN_ALLOCATION > realTokenReserves ? (CURVE_TOKEN_ALLOCATION - realTokenReserves) : 0n;
  const progressPercent = Math.min(100, Math.max(0, (Number(soldTokens) / Number(CURVE_TOKEN_ALLOCATION)) * 100));

  return {
    virtualTokenReserves,
    virtualSolReserves,
    realTokenReserves,
    realSolReserves,
    tokenTotalSupply,
    complete,
    creator,
    spotPriceSolPerToken,
    progressPercent: Number(progressPercent.toFixed(2)),
  };
}

/**
 * Calculates exact constant-product AMM return when selling tokens on Pump.fun curve
 * 
 * Formula:
 *   deltaSol = (virtualSolReserves * tokenAmount) / (virtualTokenReserves + tokenAmount)
 *   fee = ceil(deltaSol * feeBps / 10000)
 *   netSol = deltaSol - fee
 */
export function calculateSellReturn(tokenAmount, virtualTokenReserves, virtualSolReserves, feeBps = PUMP_FEE_BPS) {
  const tokens = BigInt(tokenAmount);
  const vTokens = BigInt(virtualTokenReserves);
  const vSol = BigInt(virtualSolReserves);
  const bps = BigInt(feeBps);

  if (bps < 0n || bps > 10000n) {
    throw new Error('feeBps must be an integer between 0 and 10000');
  }

  if (tokens <= 0n || vTokens <= 0n || vSol <= 0n) {
    return { grossSolLamports: 0n, feeLamports: 0n, netSolLamports: 0n, netSolFloat: 0 };
  }

  const grossSolLamports = (vSol * tokens) / (vTokens + tokens);
  // Protocol-exact ceiling rounding for fee calculation (Sol finding F07 / P10)
  const feeLamports = grossSolLamports > 0n ? (grossSolLamports * bps + 9999n) / 10000n : 0n;
  const netSolLamports = grossSolLamports > feeLamports ? grossSolLamports - feeLamports : 0n;
  const netSolFloat = Number(netSolLamports) / 1e9;

  return {
    grossSolLamports,
    feeLamports,
    netSolLamports,
    netSolFloat,
  };
}

/**
 * Calculates minimum acceptable SOL output given slippage tolerance
 * Strictly validates slippage range [0, 50] to fail closed on invalid inputs (Sol finding F10).
 */
export function calculateMinSolOutput(expectedSolLamports, slippagePercent = 5) {
  const numSlip = typeof slippagePercent === 'string' ? Number(slippagePercent) : slippagePercent;
  if (typeof numSlip !== 'number' || Number.isNaN(numSlip) || numSlip < 0 || numSlip > 50) {
    throw new Error(`Slippage percent must be a valid number between 0 and 50, got: ${slippagePercent}`);
  }

  const expected = BigInt(expectedSolLamports);
  if (expected <= 0n) {
    return 0n;
  }

  const slipBasisPoints = BigInt(Math.floor((100 - numSlip) * 100));
  return (expected * slipBasisPoints) / 10000n;
}

/**
 * Assembles atomic Pump.fun Sell Instruction (14 accounts, modern official IDL)
 */
export function createPumpSellInstruction({
  mint,
  user,
  creator = null,
  tokenAmount,
  sellTokens,
  minSolOutput,
  programId = PUMP_PROGRAM_ID,
  feeRecipient = PUMP_FEE_RECIPIENT,
  feeProgramId = PUMP_FEE_PROGRAM_ID,
}) {
  const actualTokenAmount = tokenAmount != null ? tokenAmount : sellTokens;
  if (actualTokenAmount == null) {
    throw new Error('tokenAmount (or sellTokens) is required for createPumpSellInstruction');
  }
  const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
  const userPubkey = typeof user === 'string' ? new PublicKey(user) : user;
  const feeRecipientPubkey = typeof feeRecipient === 'string' ? new PublicKey(feeRecipient) : feeRecipient;

  const { pda: bondingCurvePda } = getBondingCurvePDA(mintPubkey, programId);
  const associatedBondingCurve = getBondingCurveATA(mintPubkey, bondingCurvePda);
  const associatedUser = getAssociatedTokenAddressSync(mintPubkey, userPubkey);
  const { pda: globalPda } = getGlobalPDA(programId);
  const { pda: eventAuthorityPda } = getEventAuthorityPDA(programId);

  // If creator is not provided, fall back to userPubkey
  const creatorPubkey = creator ? (typeof creator === 'string' ? new PublicKey(creator) : creator) : userPubkey;
  const { pda: creatorVaultPda } = getCreatorVaultPDA(creatorPubkey, programId);
  const { pda: feeConfigPda } = getFeeConfigPDA(programId, feeProgramId);

  // Instruction Data: [8-byte discriminator] + [8-byte u64 LE amount] + [8-byte u64 LE min_sol_output]
  const data = Buffer.alloc(24);
  DISCRIMINATOR_SELL.copy(data, 0);
  data.writeBigUInt64LE(BigInt(actualTokenAmount), 8);
  data.writeBigUInt64LE(BigInt(minSolOutput), 16);

  // Exact 14 accounts matching modern official Pump.fun IDL (Sol finding F01)
  const keys = [
    { pubkey: globalPda, isSigner: false, isWritable: false },               // 0: global
    { pubkey: feeRecipientPubkey, isSigner: false, isWritable: true },       // 1: fee_recipient
    { pubkey: mintPubkey, isSigner: false, isWritable: false },              // 2: mint
    { pubkey: bondingCurvePda, isSigner: false, isWritable: true },          // 3: bonding_curve
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },   // 4: associated_bonding_curve
    { pubkey: associatedUser, isSigner: false, isWritable: true },           // 5: associated_user
    { pubkey: userPubkey, isSigner: true, isWritable: true },                // 6: user
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 7: system_program
    { pubkey: creatorVaultPda, isSigner: false, isWritable: true },          // 8: creator_vault
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },        // 9: token_program
    { pubkey: eventAuthorityPda, isSigner: false, isWritable: false },       // 10: event_authority
    { pubkey: programId, isSigner: false, isWritable: false },               // 11: program
    { pubkey: feeConfigPda, isSigner: false, isWritable: false },            // 12: fee_config
    { pubkey: feeProgramId, isSigner: false, isWritable: false },            // 13: fee_program
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
}
