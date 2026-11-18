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

import { MINT_SIZE, METADATA_PROGRAM_ID, U64_MAX, calculateRawAmount, getUtf8ByteLength, getMetadataPDA, checkSignatureStatus } from './solana.js';

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
