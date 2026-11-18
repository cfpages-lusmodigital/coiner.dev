// src/lib/solana.js
// Sovereign, Trustless Client-Side Solana SPL Token Creator Engine
// Constructs and broadcasts single atomic transaction signed by user wallet.

import { Buffer } from 'buffer';
import { PublicKey } from '@solana/web3.js';

export const MINT_SIZE = 82;

export const METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
);

export const U64_MAX = 18446744073709551615n;

/**
 * Computes UTF-8 byte length of a string (Metaplex uses Rust string byte slices)
 */
export function getUtf8ByteLength(str) {
  return new TextEncoder().encode(str || '').length;
}

/**
 * Derives Metaplex Metadata PDA for a given mint
 */
export function getMetadataPDA(mintPublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      mintPublicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
  return pda;
}

/**
 * Checks if a transaction signature was confirmed on-chain
 * Returns tagged status contract: { kind: 'confirmed' | 'pending' | 'failed' | 'not_found' | 'rpc_unavailable', ... }
 */
export async function checkSignatureStatus(connection, signature) {
  if (!signature) return { kind: 'not_found', value: null };
  try {
    const status = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    if (!status || !status.value) {
      return { kind: 'not_found', value: null };
    }
    if (status.value.err) {
      return {
        kind: 'failed',
        error: status.value.err,
        confirmationStatus: status.value.confirmationStatus,
      };
    }
    if (status.value.confirmationStatus === 'processed') {
      return { kind: 'pending', confirmationStatus: 'processed' };
    }
    if (
      status.value.confirmationStatus === 'confirmed' ||
      status.value.confirmationStatus === 'finalized'
    ) {
      return {
        kind: 'confirmed',
        confirmationStatus: status.value.confirmationStatus,
      };
    }
    return { kind: 'pending', confirmationStatus: status.value.confirmationStatus };
  } catch (err) {
    console.warn('Error checking signature status:', err);
    return { kind: 'rpc_unavailable', error: err?.message || String(err) };
  }
}

/**
 * Calculates raw integer token amount from human-readable supply string & decimals
 * Strictly validates:
 * 1. decimals must be an exact single digit integer 0..9 (rejects floats like '1.9', negative, hex, etc.)
 * 2. supply must be a positive decimal number matching /^[0-9]+(\.[0-9]+)?$/ (rejects hex '0x10', exponents '1e6', negatives)
 * 3. fractional digits count cannot exceed decimals (no silent truncation: '1.234' with 2 decimals throws)
 * 4. raw supply must be at least 1n ('0.0000001' with 6 decimals throws)
 * 5. raw supply must not exceed U64_MAX (18446744073709551615n)
 */
export function calculateRawAmount(supplyStr, decimals) {
  // 1. Validate decimals strictly
  const decStr = String(decimals != null ? decimals : '').trim();
  if (!/^[0-9]$/.test(decStr)) {
    throw new Error(`Token Decimals must be an integer between 0 and 9 (got "${decimals}").`);
  }
  const decInt = Number(decStr);

  // 2. Validate supply string strictly
  const cleanSupply = String(supplyStr != null ? supplyStr : '').replace(/,/g, '').trim();
  if (!cleanSupply || !/^[0-9]+(\.[0-9]+)?$/.test(cleanSupply)) {
    throw new Error(`Invalid token supply: "${supplyStr}". Supply must be a positive decimal number (hex, exponents, and negative numbers are not allowed).`);
  }

  const parts = cleanSupply.split('.');
  const wholePart = parts[0].replace(/^0+/, '') || '0';
  const fracPart = parts[1] || '';

  // 3. Fractional precision check: reject truncation
  if (fracPart.length > decInt) {
    throw new Error(`Token supply fractional precision (${fracPart.length} decimals) exceeds token decimals (${decInt}). Truncation is not permitted.`);
  }

  const paddedFrac = fracPart.padEnd(decInt, '0');
  const combined = (wholePart === '0' ? paddedFrac.replace(/^0+/, '') || '0' : wholePart + paddedFrac);
  const raw = BigInt(combined);

  // 4. Raw range checks: 1 <= raw <= U64_MAX
  if (raw < 1n) {
    throw new Error(`Calculated raw token supply is 0. Supply must be at least 1 unit (${decInt > 0 ? '0.' + '0'.repeat(decInt - 1) + '1' : '1'}).`);
  }
  if (raw > U64_MAX) {
    throw new Error(`Total raw supply (${raw.toString()}) exceeds Solana u64 limit (${U64_MAX.toString()}). Please reduce supply or decimals.`);
  }

  return raw;
}

/**
 * Pre-estimates exact on-chain rent costs in SOL (with transparent itemized breakdown)
 */
export async function estimateRentCosts(
  connection,
  platformFeeSol = 0,
  isMainnet = false,
  priorityFeeMicroLamports = 0
) {
  const metaplexProtocolLamports = isMainnet ? 10_000_000n : 0n; // 0.01 SOL on mainnet
  const priorityLamports = BigInt(
    Math.ceil((Number(priorityFeeMicroLamports || 0) * 250000) / 1000000)
  );
  const networkGasBuffer = 10_000n + priorityLamports; // 5000-10000 base fee + compute budget priority
  const networkGasSol = (Number(networkGasBuffer) / 1e9).toFixed(5);

  try {
    const mintRent = BigInt(await connection.getMinimumBalanceForRentExemption(MINT_SIZE));
    // Classic ATA is 165 bytes
    const ataRent = BigInt(await connection.getMinimumBalanceForRentExemption(165));
    // Metaplex Metadata V3 PDA is ~679 bytes
    const metadataRent = BigInt(await connection.getMinimumBalanceForRentExemption(679));

    const feeLamports = BigInt(Math.round(Number(platformFeeSol) * 1e9));

    const totalLamports =
      mintRent + ataRent + metadataRent + metaplexProtocolLamports + networkGasBuffer + feeLamports;

    const onChainRentLamports = mintRent + ataRent + metadataRent + metaplexProtocolLamports + networkGasBuffer;

    return {
      source: 'live',
      canAuthorizeSpend: true,
      mintRentSol: (Number(mintRent) / 1e9).toFixed(5),
      ataRentSol: (Number(ataRent) / 1e9).toFixed(5),
      metadataRentSol: (Number(metadataRent) / 1e9).toFixed(5),
      metaplexProtocolSol: (Number(metaplexProtocolLamports) / 1e9).toFixed(5),
      networkGasSol,
      onChainRentSol: (Number(onChainRentLamports) / 1e9).toFixed(5),
      platformFeeSol: Number(platformFeeSol).toFixed(5),
      estimatedTotalSol: (Number(totalLamports) / 1e9).toFixed(5),
      totalLamports: totalLamports.toString(),
    };
  } catch {
    const fee = Number(platformFeeSol);
    const metaProtocol = isMainnet ? 0.01 : 0.0;
    const gasNum = Number(networkGasBuffer) / 1e9;
    const rentBase = 0.00666 + metaProtocol + gasNum;
    const baseTotal = rentBase + fee;
    const fallbackLamports = BigInt(Math.round(baseTotal * 1e9));
    return {
      source: 'fallback',
      canAuthorizeSpend: false,
      mintRentSol: '0.00107',
      ataRentSol: '0.00149',
      metadataRentSol: '0.00410',
      metaplexProtocolSol: metaProtocol.toFixed(5),
      networkGasSol,
      onChainRentSol: rentBase.toFixed(5),
      platformFeeSol: fee.toFixed(5),
      estimatedTotalSol: baseTotal.toFixed(5),
      totalLamports: fallbackLamports.toString(),
    };
  }
}

/**
 * Builds and executes the atomic Solana Token Creation transaction
 */
export async function createSolanaToken(options) {
  const { createSolanaToken: create } = await import('./tokenTransaction.js');
  return create(options);
}
