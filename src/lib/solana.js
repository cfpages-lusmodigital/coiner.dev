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
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { getCreateMetadataAccountV3InstructionDataSerializer } from '@metaplex-foundation/mpl-token-metadata';

export const METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
);

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
 * Calculates raw integer token amount from human-readable supply string & decimals
 */
export function calculateRawAmount(supplyStr, decimals) {
  const cleanSupply = supplyStr.replace(/,/g, '').trim();
  const parts = cleanSupply.split('.');
  const wholePart = parts[0] || '0';
  const fracPart = (parts[1] || '').slice(0, decimals).padEnd(decimals, '0');
  const fullIntStr = wholePart + fracPart;
  return BigInt(fullIntStr);
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

    return {
      mintRentSol: (Number(mintRent) / 1e9).toFixed(5),
      ataRentSol: (Number(ataRent) / 1e9).toFixed(5),
      metadataRentSol: (Number(metadataRent) / 1e9).toFixed(5),
      metaplexProtocolSol: (Number(metaplexProtocolLamports) / 1e9).toFixed(5),
      networkGasSol,
      platformFeeSol: Number(platformFeeSol).toFixed(5),
      estimatedTotalSol: (Number(totalLamports) / 1e9).toFixed(5),
    };
  } catch {
    const fee = Number(platformFeeSol);
    const metaProtocol = isMainnet ? 0.01 : 0.0;
    const gasNum = Number(networkGasBuffer) / 1e9;
    const baseTotal = 0.00666 + metaProtocol + fee + gasNum;
    return {
      mintRentSol: '0.00107',
      ataRentSol: '0.00149',
      metadataRentSol: '0.00410',
      metaplexProtocolSol: metaProtocol.toFixed(5),
      networkGasSol,
      platformFeeSol: fee.toFixed(5),
      estimatedTotalSol: baseTotal.toFixed(5),
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
    metadataUri,
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

  const userPublicKey = wallet.publicKey;

  onProgress('preparing', 'Calculating rent-exemption and preparing keypairs...');

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
  const parsedDecimals = parseInt(decimals != null ? String(decimals) : '6', 10);
  const safeDecimals = Number.isNaN(parsedDecimals) ? 6 : Math.max(0, Math.min(9, parsedDecimals));
  const rawSupply = calculateRawAmount(String(supply), safeDecimals);
  const U64_MAX = 18446744073709551615n;
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

  // 5c. Initialize Mint
  transaction.add(
    createInitializeMintInstruction(
      mintPublicKey,
      safeDecimals,
      userPublicKey,
      userPublicKey, // temporary freeze authority before revoking
      TOKEN_PROGRAM_ID
    )
  );

  // 5d. Create Associated Token Account for Creator
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

  // 5e. Mint 100% of supply to Creator's ATA
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

  // 5f. Metaplex Metadata V3 Instruction
  const metadataSerializer = getCreateMetadataAccountV3InstructionDataSerializer();
  const metadataInstructionData = Buffer.from(
    metadataSerializer.serialize({
      data: {
        name,
        symbol,
        uri: metadataUri,
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

  // 5g. Revoke Freeze Authority (Mandatory for Raydium liquidity pool creation)
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

  // 5h. Revoke Mint Authority (Ensures 100% fixed supply, zero rug risk)
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

  // 8. Sign and Send with User Wallet
  onProgress('broadcasting', 'Broadcasting atomic transaction to Solana network...');
  const signature = await wallet.sendTransaction(transaction, connection, {
    signers: [mintKeypair],
  });

  // 9. Confirm Transaction
  onProgress('confirming', `Waiting for on-chain confirmation (tx: ${signature.slice(0, 8)}...)...`);
  const confirmation = await connection.confirmTransaction(
    {
      blockhash,
      lastValidBlockHeight,
      signature,
    },
    'confirmed'
  );

  if (confirmation.value.err) {
    throw new Error(
      `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`
    );
  }

  onProgress('success', 'Token successfully created on Solana!');

  return {
    success: true,
    signature,
    mintAddress: mintPublicKey.toBase58(),
    userAta: userAta.toBase58(),
    name,
    symbol,
  };
}
