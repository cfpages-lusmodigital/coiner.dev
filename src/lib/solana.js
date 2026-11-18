// src/lib/solana.js
// Sovereign, Trustless Client-Side Solana SPL Token Creator Engine
// Constructs and broadcasts single atomic transaction signed by user wallet.

import { Buffer } from 'buffer';
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';

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
export async function createSolanaToken({
  connection,
  wallet,
  tokenConfig,
  onProgress = () => {},
}) {
  const {
    name,
    symbol,
    decimals = 6,
    supply = '1000000000',
    metadataUri = '',
    revokeFreeze = true,
    revokeMint = true,
    immutable = true,
    priorityFeeMicroLamports = 50000, // 0.05 lamports/CU default
    platformFeeSol = 0,
    treasuryAddress = import.meta.env.VITE_TREASURY_WALLET || '2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV',
  } = tokenConfig;

  if (!wallet || !wallet.publicKey) {
    throw new Error('Please connect your Solana wallet (Phantom, Solflare, etc.).');
  }

  // Strict Token Config Validation (Metaplex checks Rust string UTF-8 byte lengths)
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    throw new Error('Token Name is required.');
  }
  const nameBytes = getUtf8ByteLength(trimmedName);
  if (nameBytes > 32) {
    throw new Error(`Token Name exceeds Metaplex limit of 32 UTF-8 bytes (got ${nameBytes} bytes).`);
  }

  const trimmedSymbol = (symbol || '').trim().toUpperCase();
  if (!trimmedSymbol) {
    throw new Error('Token Symbol is required.');
  }
  const symbolBytes = getUtf8ByteLength(trimmedSymbol);
  if (symbolBytes > 10) {
    throw new Error(`Token Symbol exceeds Metaplex limit of 10 UTF-8 bytes (got ${symbolBytes} bytes).`);
  }

  const decStr = String(decimals != null ? decimals : '6').trim();
  if (!/^[0-9]$/.test(decStr)) {
    throw new Error(`Token Decimals must be an integer between 0 and 9 (got "${decimals}").`);
  }
  const parsedDecimals = Number(decStr);

  const trimmedUri = (metadataUri || '').trim();
  if (!trimmedUri) {
    throw new Error('Metadata URI is required to initialize on-chain Metaplex metadata. Please upload metadata to IPFS/Arweave first.');
  }
  const uriBytes = getUtf8ByteLength(trimmedUri);
  if (uriBytes > 200) {
    throw new Error(`Metadata URI exceeds Metaplex limit of 200 UTF-8 bytes (got ${uriBytes} bytes).`);
  }

  const userPublicKey = wallet.publicKey;

  onProgress('preparing', 'Calculating rent-exemption and preparing keypairs...');

  // U10 Performance optimization: Load SPL Token & Metaplex only when assembling transaction
  const [splToken, metaplex] = await Promise.all([
    import('@solana/spl-token'),
    import('@metaplex-foundation/mpl-token-metadata'),
  ]);
  const {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createInitializeMintInstruction,
    createAssociatedTokenAccountIdempotentInstruction,
    createMintToInstruction,
    createSetAuthorityInstruction,
    AuthorityType,
    getAssociatedTokenAddressSync,
  } = splToken;
  const { getCreateMetadataAccountV3InstructionDataSerializer } = metaplex;

  // 1. Generate keypair for new mint
  const mintKeypair = Keypair.generate();
  const mintPublicKey = mintKeypair.publicKey;

  // 2. Derive ATA & Metadata PDA
  const userAta = getAssociatedTokenAddressSync(
    mintPublicKey,
    userPublicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const metadataPDA = getMetadataPDA(mintPublicKey);

  // 3. Fetch rent for Mint account
  const lamportsForMint = await connection.getMinimumBalanceForRentExemption(
    MINT_SIZE
  );

  // 4. Calculate total raw supply (BigInt safe with u64 boundary check)
  const rawSupply = calculateRawAmount(String(supply), parsedDecimals);
  if (rawSupply > U64_MAX) {
    throw new Error(
      'Total raw supply exceeds Solana u64 maximum limit (18,446,744,073,709,551,615). Please reduce supply or decimals.'
    );
  }

  // 5. Build Transaction
  const transaction = new Transaction();

  // 5a. Set Compute Budget & Priority Fee
  if (priorityFeeMicroLamports > 0) {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFeeMicroLamports,
      })
    );
  }
  // Standard CU limit for token creation + metadata is ~150,000 CU
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 250000,
    })
  );

  // 5b. Platform Service Fee Transfer (Public: 0.15 SOL bundled base fee; Admin: 0.00 SOL)
  if (platformFeeSol > 0) {
    if (!treasuryAddress) {
      throw new Error(
        'Platform treasury wallet (VITE_TREASURY_WALLET) is not configured. Platform fee cannot be collected.'
      );
    }
    const feeLamports = BigInt(Math.round(Number(platformFeeSol) * 1e9));
    if (feeLamports > 0n) {
      const treasuryPubkey = new PublicKey(treasuryAddress);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPublicKey,
          toPubkey: treasuryPubkey,
          lamports: feeLamports,
        })
      );
    }
  }

  // 5c. Create Account for Mint
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: userPublicKey,
      newAccountPubkey: mintPublicKey,
      space: MINT_SIZE,
      lamports: lamportsForMint,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  // 5d. Initialize Mint
  transaction.add(
    createInitializeMintInstruction(
      mintPublicKey,
      parsedDecimals,
      userPublicKey,
      userPublicKey, // temporary freeze authority before revoking
      TOKEN_PROGRAM_ID
    )
  );

  // 5e. Create Associated Token Account for Creator
  transaction.add(
    createAssociatedTokenAccountIdempotentInstruction(
      userPublicKey,
      userAta,
      userPublicKey,
      mintPublicKey,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // 5f. Mint 100% of supply to Creator's ATA
  transaction.add(
    createMintToInstruction(
      mintPublicKey,
      userAta,
      userPublicKey,
      rawSupply,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 5g. Metaplex Metadata V3 Instruction
  const metadataSerializer = getCreateMetadataAccountV3InstructionDataSerializer();
  const metadataInstructionData = Buffer.from(
    metadataSerializer.serialize({
      data: {
        name: trimmedName,
        symbol: trimmedSymbol,
        uri: trimmedUri,
        sellerFeeBasisPoints: 0,
        creators: [
          {
            address: userPublicKey,
            verified: true,
            share: 100,
          },
        ],
        collection: null,
        uses: null,
      },
      isMutable: !immutable,
      collectionDetails: null,
    })
  );

  const createMetadataAccountIx = new TransactionInstruction({
    keys: [
      { pubkey: metadataPDA, isSigner: false, isWritable: true },
      { pubkey: mintPublicKey, isSigner: false, isWritable: false },
      { pubkey: userPublicKey, isSigner: true, isWritable: false }, // mintAuthority
      { pubkey: userPublicKey, isSigner: true, isWritable: true },  // payer
      { pubkey: userPublicKey, isSigner: false, isWritable: false }, // updateAuthority
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: METADATA_PROGRAM_ID,
    data: metadataInstructionData,
  });
  transaction.add(createMetadataAccountIx);

  // 5h. Revoke Freeze Authority (Mandatory for Raydium liquidity pool creation)
  if (revokeFreeze) {
    transaction.add(
      createSetAuthorityInstruction(
        mintPublicKey,
        userPublicKey,
        AuthorityType.FreezeAccount,
        null,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  // 5i. Revoke Mint Authority (Ensures 100% fixed supply, zero rug risk)
  if (revokeMint) {
    transaction.add(
      createSetAuthorityInstruction(
        mintPublicKey,
        userPublicKey,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  // 6. Fetch Blockhash & set fee payer
  onProgress('signing', 'Awaiting wallet signature in Phantom / Solflare...');
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = userPublicKey;

  // 7. Partial sign with the Mint Keypair
  transaction.partialSign(mintKeypair);

  // 8. Size Verification (Solana MTU limit is 1232 bytes)
  const serialized = transaction.serialize({ requireAllSignatures: false });
  if (serialized.length > 1232) {
    throw new Error(
      `Transaction size (${serialized.length} bytes) exceeds Solana MTU packet limit of 1232 bytes. Please shorten token name or metadata URI.`
    );
  }

  // 9. Sign and Send with User Wallet
  onProgress('broadcasting', 'Broadcasting atomic transaction to Solana network...');
  let signature;
  try {
    signature = await wallet.sendTransaction(transaction, connection, {
      signers: [mintKeypair],
    });
  } catch (sendErr) {
    throw sendErr;
  }

  const launchContext = {
    signature,
    mintAddress: mintPublicKey.toBase58(),
    userAta: userAta.toBase58(),
    name: trimmedName,
    symbol: trimmedSymbol,
  };

  // 10. Confirm Transaction
  onProgress('confirming', `Waiting for on-chain confirmation (tx: ${signature.slice(0, 8)}...)...`);
  try {
    const confirmation = await connection.confirmTransaction(
      {
        blockhash,
        lastValidBlockHeight,
        signature,
      },
      'confirmed'
    );

    if (confirmation && confirmation.value && confirmation.value.err) {
      const err = new Error(
        `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`
      );
      err.signature = signature;
      err.launchContext = launchContext;
      throw err;
    }
  } catch (confirmErr) {
    // If confirmation timed out or threw, check on-chain status before declaring failure
    const statusResult = await checkSignatureStatus(connection, signature);
    if (statusResult?.kind === 'confirmed') {
      onProgress('success', 'Token successfully created and confirmed on Solana!');
      return {
        success: true,
        ...launchContext,
      };
    }
    // Retain launch context so caller / UI can reconcile instead of creating a second mint
    const wrappedErr = new Error(
      `Transaction was broadcast with signature ${signature}, but confirmation timed out or errored: ${confirmErr.message}. Check Solscan before retrying.`
    );
    wrappedErr.signature = signature;
    wrappedErr.launchContext = launchContext;
    throw wrappedErr;
  }

  onProgress('success', 'Token successfully created on Solana!');

  return {
    success: true,
    ...launchContext,
  };
}
