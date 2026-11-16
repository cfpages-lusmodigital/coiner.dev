#!/usr/bin/env node
/**
 * coiner-cli.js — Sovereign Headless Solana SPL Token Creator CLI
 * 
 * Allows creating, simulating, and validating Solana tokens directly from the terminal
 * with zero UI requirements. Supports non-custodial keypair files, atomic transaction construction,
 * dual-tier admin fee exemption, rent estimation, strict argument validation, and dry-run mode.
 * 
 * Usage:
 *   node bin/coiner-cli.js create --name "My Token" --symbol "MTK" --supply 1000000000 --metadata-uri "https://ipfs.io/ipfs/Qm..." --dry-run
 *   node bin/coiner-cli.js create --keypair ~/.config/solana/id.json --name "Sol Cat" --symbol "SCAT" --metadata-uri "https://..." --network devnet
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import process from 'process';
import { Buffer } from 'buffer';
import { parseArgs } from 'node:util';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  clusterApiUrl,
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
import {
  calculateRawAmount,
  getUtf8ByteLength,
  checkSignatureStatus,
  U64_MAX,
} from '../src/lib/solana.js';

// Program constants
export const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
export const DEFAULT_TREASURY_WALLET = '2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV';
export const DEFAULT_ADMIN_WALLETS = [
  '2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV',
];

export const PRIORITY_FEE_MAP = {
  normal: 50000,   // ~0.0000125 SOL at 250k CU
  fast: 250000,    // ~0.0000625 SOL at 250k CU
  turbo: 1000000,  // ~0.0002500 SOL at 250k CU
};

/**
 * Derives Metaplex Metadata PDA
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
 * Checks if a public key belongs to the canonical admin allowlist (exact case-sensitive Base58)
 */
export function isAdminWallet(publicKeyStr, customAdmins = []) {
  if (!publicKeyStr) return false;
  try {
    const canonical = new PublicKey(String(publicKeyStr).trim()).toBase58();
    const allowlist = [...DEFAULT_ADMIN_WALLETS, ...customAdmins].map((a) => {
      try {
        return new PublicKey(String(a).trim()).toBase58();
      } catch {
        return '';
      }
    }).filter(Boolean);
    return allowlist.includes(canonical);
  } catch {
    return false;
  }
}

/**
 * Calculates platform fee: 0.00 SOL for admin, 0.15 SOL flat base (+0.05 SOL per kept authority if customized)
 */
export function calculatePlatformFee({ isAdmin, revokeFreeze, revokeMint, immutable }) {
  if (isAdmin) return 0.0;
  let fee = 0.15;
  if (!revokeFreeze) fee += 0.05;
  if (!revokeMint) fee += 0.05;
  if (!immutable) fee += 0.05;
  return Number(fee.toFixed(2));
}

/**
 * Estimates exact on-chain rent costs in SOL
 */
export async function estimateRentCosts(
  connection,
  platformFeeSol = 0,
  isMainnet = false,
  priorityFeeMicroLamports = 250000
) {
  const metaplexProtocolLamports = isMainnet ? 10_000_000n : 0n; // 0.01 SOL on mainnet
  const priorityLamports = BigInt(
    Math.ceil((Number(priorityFeeMicroLamports || 0) * 250000) / 1000000)
  );
  const networkGasBuffer = 10_000n + priorityLamports;

  let mintRent = 2039280n;
  let ataRent = 2039280n;
  let metadataRent = 5616720n;

  try {
    mintRent = BigInt(await connection.getMinimumBalanceForRentExemption(MINT_SIZE));
    ataRent = BigInt(await connection.getMinimumBalanceForRentExemption(165));
    metadataRent = BigInt(await connection.getMinimumBalanceForRentExemption(679));
  } catch {
    // fallback to standard constants
  }

  const feeLamports = BigInt(Math.round(Number(platformFeeSol) * 1e9));
  const totalLamports =
    mintRent + ataRent + metadataRent + metaplexProtocolLamports + networkGasBuffer + feeLamports;

  return {
    mintRentSol: (Number(mintRent) / 1e9).toFixed(5),
    ataRentSol: (Number(ataRent) / 1e9).toFixed(5),
    metadataRentSol: (Number(metadataRent) / 1e9).toFixed(5),
    metaplexProtocolSol: (Number(metaplexProtocolLamports) / 1e9).toFixed(5),
    networkGasSol: (Number(networkGasBuffer) / 1e9).toFixed(5),
    platformFeeSol: Number(platformFeeSol).toFixed(5),
    estimatedTotalSol: (Number(totalLamports) / 1e9).toFixed(5),
    totalLamports: totalLamports.toString(),
  };
}

/**
 * Loads a Solana Keypair from a file or environment
 */
export function loadKeypair(keypairPath) {
  let resolvedPath = keypairPath;
  if (!resolvedPath) {
    // Check standard Solana CLI location
    const defaultSolanaPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
    if (fs.existsSync(defaultSolanaPath)) {
      resolvedPath = defaultSolanaPath;
    } else if (process.env.SOLANA_KEYPAIR) {
      resolvedPath = process.env.SOLANA_KEYPAIR;
    }
  }

  if (!resolvedPath) {
    throw new Error(
      'No keypair specified. Provide --keypair <path>, set $env:SOLANA_KEYPAIR, or create ~/.config/solana/id.json.'
    );
  }

  const expandedPath = resolvedPath.startsWith('~')
    ? path.join(os.homedir(), resolvedPath.slice(1))
    : path.resolve(resolvedPath);

  if (!fs.existsSync(expandedPath)) {
    throw new Error(`Keypair file not found at: ${expandedPath}`);
  }

  const rawData = fs.readFileSync(expandedPath, 'utf-8');
  try {
    const parsed = JSON.parse(rawData);
    if (Array.isArray(parsed)) {
      return Keypair.fromSecretKey(Uint8Array.from(parsed));
    }
    throw new Error('Keypair JSON must be an array of numbers');
  } catch (e) {
    throw new Error(`Failed to parse keypair JSON from ${expandedPath}: ${e.message}`);
  }
}

/**
 * Prints CLI Help text
 */
function printHelp() {
  console.log(`
coiner-cli — Sovereign Solana Token Creator CLI

USAGE:
  node bin/coiner-cli.js <command> [options]

COMMANDS:
  create       Build and broadcast (or simulate) a new Solana SPL token
  estimate     Estimate exact on-chain rent and platform fees
  balance      Check SOL balance of connected or specified keypair
  help         Display this help message

OPTIONS:
  --keypair <path>       Path to payer Solana keypair JSON file (required for live create)
  --network <net>        Network: 'devnet', 'mainnet-beta', or 'testnet' (default: devnet)
  --rpc <url>            Custom RPC URL (overrides default network cluster)
  --name <string>        Token Name (1 to 32 UTF-8 bytes) [REQUIRED for create]
  --symbol <string>      Token Symbol / Ticker (1 to 10 UTF-8 bytes) [REQUIRED for create]
  --decimals <int>       Decimals: 0 to 9 integer (default: 6)
  --supply <number>      Total Supply to mint (strict positive decimal, default: 1000000000)
  --metadata-uri <url>   Metaplex standard JSON metadata URI (HTTP/HTTPS URL, max 200 bytes) [REQUIRED for create]
  --keep-freeze          Retain Freeze Authority (default: revoked)
  --keep-mint            Retain Mint Authority (default: revoked)
  --mutable              Keep metadata mutable (default: immutable)
  --priority <speed>     Priority fee: 'normal', 'fast', 'turbo' (default: turbo)
  --treasury <pubkey>    Treasury address receiving platform fee
  --dry-run              Simulate full transaction assembly & MTU check without broadcasting
  --json                 Output structured JSON response on stdout/stderr
  --help, -h             Show this help message

EXAMPLES:
  # Dry-run test on Devnet with pre-uploaded metadata
  node bin/coiner-cli.js create --name "Sol Cat" --symbol "SCAT" --metadata-uri "https://gateway.pinata.cloud/ipfs/QmExample" --dry-run --json

  # Create real token on Devnet with explicit keypair
  node bin/coiner-cli.js create --keypair ~/.config/solana/id.json --name "Sol Cat" --symbol "SCAT" --metadata-uri "https://gateway.pinata.cloud/ipfs/QmExample" --network devnet

  # Estimate fees as JSON
  node bin/coiner-cli.js estimate --network devnet --json
`);
}

const PARSE_OPTIONS = {
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', short: 'v', default: false },
  json: { type: 'boolean', default: false },
  'dry-run': { type: 'boolean', default: false },
  network: { type: 'string', default: 'devnet' },
  rpc: { type: 'string' },
  keypair: { type: 'string', short: 'k' },
  name: { type: 'string' },
  symbol: { type: 'string' },
  decimals: { type: 'string', default: '6' },
  supply: { type: 'string', default: '1000000000' },
  'metadata-uri': { type: 'string' },
  description: { type: 'string' },
  'keep-freeze': { type: 'boolean', default: false },
  'keep-mint': { type: 'boolean', default: false },
  mutable: { type: 'boolean', default: false },
  priority: { type: 'string', default: 'turbo' },
  treasury: { type: 'string', default: DEFAULT_TREASURY_WALLET },
};

/**
 * Main execution entrypoint
 */
async function run() {
  const isJsonRequested = process.argv.includes('--json');

  let parsed;
  try {
    parsed = parseArgs({
      options: PARSE_OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    if (isJsonRequested) {
      console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
    } else {
      console.error(`CLI Argument Error: ${err.message}`);
      console.error(`Run 'node bin/coiner-cli.js --help' for usage instructions.`);
    }
    process.exitCode = 1;
    return;
  }

  const { values, positionals } = parsed;
  const isJson = values.json;

  if (values.help || positionals.length === 0 || positionals[0] === 'help') {
    printHelp();
    return;
  }

  const command = positionals[0];
  const ALLOWED_COMMANDS = ['create', 'estimate', 'balance', 'help'];
  if (!ALLOWED_COMMANDS.includes(command)) {
    const msg = `Unknown command "${command}". Allowed commands: ${ALLOWED_COMMANDS.join(', ')}.`;
    if (isJson) {
      console.error(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exitCode = 1;
    return;
  }

  if (positionals.length > 1) {
    const msg = `Unexpected extra positional arguments: ${positionals.slice(1).join(', ')}`;
    if (isJson) {
      console.error(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exitCode = 1;
    return;
  }

  // Network validation
  const ALLOWED_NETWORKS = ['devnet', 'mainnet-beta', 'testnet'];
  if (!ALLOWED_NETWORKS.includes(values.network)) {
    const msg = `Invalid network "${values.network}". Allowed networks: ${ALLOWED_NETWORKS.join(', ')}.`;
    if (isJson) {
      console.error(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exitCode = 1;
    return;
  }

  // Priority validation
  const priorityLower = (values.priority || 'turbo').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(PRIORITY_FEE_MAP, priorityLower)) {
    const msg = `Invalid priority "${values.priority}". Allowed priorities: ${Object.keys(PRIORITY_FEE_MAP).join(', ')}.`;
    if (isJson) {
      console.error(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exitCode = 1;
    return;
  }

  const isMainnet = values.network === 'mainnet-beta';
  const rpcUrl = values.rpc || clusterApiUrl(values.network);
  const connection = new Connection(rpcUrl, 'confirmed');

  // Command: balance
  if (command === 'balance') {
    try {
      const payerKeypair = loadKeypair(values.keypair);
      const balanceLamports = await connection.getBalance(payerKeypair.publicKey);
      const balanceSol = (balanceLamports / 1e9).toFixed(5);

      if (isJson) {
        console.log(JSON.stringify({
          success: true,
          address: payerKeypair.publicKey.toBase58(),
          balanceSol,
          balanceLamports: balanceLamports.toString(),
          network: values.network,
          rpcUrl,
        }, null, 2));
      } else {
        console.log(`\nWallet:  ${payerKeypair.publicKey.toBase58()}`);
        console.log(`Balance: ${balanceSol} SOL (${values.network})\n`);
      }
    } catch (err) {
      if (isJson) {
        console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exitCode = 1;
    }
    return;
  }

  // Command: estimate
  if (command === 'estimate') {
    try {
      let isAdmin = false;
      let payerAddress = 'None (Generic Estimate)';
      if (values.keypair) {
        try {
          const keypair = loadKeypair(values.keypair);
          payerAddress = keypair.publicKey.toBase58();
          isAdmin = isAdminWallet(payerAddress);
        } catch {
          // Keypair is optional for generic estimation
        }
      }

      const platformFeeSol = calculatePlatformFee({
        isAdmin,
        revokeFreeze: !values['keep-freeze'],
        revokeMint: !values['keep-mint'],
        immutable: !values.mutable,
      });

      const priorityLamports = PRIORITY_FEE_MAP[priorityLower];
      const rent = await estimateRentCosts(connection, platformFeeSol, isMainnet, priorityLamports);

      if (isJson) {
        console.log(JSON.stringify({
          success: true,
          ...rent,
          isAdmin,
          payerAddress,
          network: values.network,
          rpcUrl,
        }, null, 2));
      } else {
        console.log(`\n=== Rent & Fee Estimate (${values.network}) ===`);
        console.log(`Payer:             ${payerAddress} (Admin: ${isAdmin ? 'YES • 0.00 SOL' : 'NO'})`);
        console.log(`Mint Account Rent: ${rent.mintRentSol} SOL`);
        console.log(`Creator ATA Rent:  ${rent.ataRentSol} SOL`);
        console.log(`Metadata PDA Rent: ${rent.metadataRentSol} SOL`);
        console.log(`Metaplex Protocol: ${rent.metaplexProtocolSol} SOL`);
        console.log(`Network Gas:       ${rent.networkGasSol} SOL`);
        console.log(`Platform Fee:      ${rent.platformFeeSol} SOL`);
        console.log(`-----------------------------------------------`);
        console.log(`Estimated Total:   ${rent.estimatedTotalSol} SOL\n`);
      }
    } catch (err) {
      if (isJson) {
        console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exitCode = 1;
    }
    return;
  }

  // Command: create
  if (command === 'create') {
    try {
      const name = (values.name || '').trim();
      if (!name) {
        throw new Error('Token Name (--name) is required.');
      }
      const nameBytes = getUtf8ByteLength(name);
      if (nameBytes > 32) {
        throw new Error(`Token Name exceeds Metaplex limit of 32 UTF-8 bytes (got ${nameBytes} bytes).`);
      }

      const symbol = (values.symbol || '').trim().toUpperCase();
      if (!symbol) {
        throw new Error('Token Symbol (--symbol) is required.');
      }
      const symbolBytes = getUtf8ByteLength(symbol);
      if (symbolBytes > 10) {
        throw new Error(`Token Symbol exceeds Metaplex limit of 10 UTF-8 bytes (got ${symbolBytes} bytes).`);
      }

      const decStr = String(values.decimals != null ? values.decimals : '6').trim();
      if (!/^[0-9]$/.test(decStr)) {
        throw new Error(`Token Decimals (--decimals) must be an integer between 0 and 9 (got "${values.decimals}").`);
      }
      const decimals = Number(decStr);

      const metadataUri = (values['metadata-uri'] || '').trim();
      if (!metadataUri) {
        throw new Error('Metadata URI (--metadata-uri <url>) is required to initialize on-chain Metaplex metadata. Please upload metadata to IPFS/Arweave first.');
      }
      const uriBytes = getUtf8ByteLength(metadataUri);
      if (uriBytes > 200) {
        throw new Error(`Metadata URI exceeds Metaplex limit of 200 UTF-8 bytes (got ${uriBytes} bytes).`);
      }
      try {
        const parsedUrl = new URL(metadataUri);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Protocol must be http or https');
        }
      } catch (urlErr) {
        throw new Error(`Invalid metadata URI format: "${metadataUri}". Must be a valid HTTP/HTTPS URL.`);
      }

      const rawSupply = calculateRawAmount(values.supply, decimals);

      // Require explicit keypair for real execution to avoid spending from unintended keys
      let payerKeypair;
      if (values['dry-run']) {
        if (values.keypair) {
          try {
            payerKeypair = loadKeypair(values.keypair);
          } catch {
            payerKeypair = Keypair.generate();
          }
        } else {
          payerKeypair = Keypair.generate();
        }
      } else {
        if (!values.keypair) {
          throw new Error('A keypair file is required for live token deployment (--keypair <path>). Set $env:SOLANA_KEYPAIR or pass --keypair.');
        }
        payerKeypair = loadKeypair(values.keypair);
      }

      const payerPubkey = payerKeypair.publicKey;
      const isAdmin = isAdminWallet(payerPubkey.toBase58());
      const revokeFreeze = !values['keep-freeze'];
      const revokeMint = !values['keep-mint'];
      const immutable = !values.mutable;

      const platformFeeSol = calculatePlatformFee({
        isAdmin,
        revokeFreeze,
        revokeMint,
        immutable,
      });

      const priorityMicroLamports = PRIORITY_FEE_MAP[priorityLower];
      const rent = await estimateRentCosts(connection, platformFeeSol, isMainnet, priorityMicroLamports);

      // Pre-flight balance check for live runs
      if (!values['dry-run']) {
        const currentBalance = BigInt(await connection.getBalance(payerPubkey));
        const requiredLamports = BigInt(rent.totalLamports);
        if (currentBalance < requiredLamports) {
          const currentSol = (Number(currentBalance) / 1e9).toFixed(5);
          throw new Error(
            `Insufficient SOL balance for deployment!\n` +
            `Payer:    ${payerPubkey.toBase58()}\n` +
            `Balance:  ${currentSol} SOL\n` +
            `Required: ${rent.estimatedTotalSol} SOL (Platform Fee: ${platformFeeSol} SOL + Rent & Gas: ${(Number(rent.estimatedTotalSol) - platformFeeSol).toFixed(5)} SOL)\n` +
            `Please fund your wallet with at least ${rent.estimatedTotalSol} SOL before launching.`
          );
        }
      }

      // Generate Mint Keypair & derive PDAs
      const mintKeypair = Keypair.generate();
      const mintPubkey = mintKeypair.publicKey;

      const userAta = getAssociatedTokenAddressSync(
        mintPubkey,
        payerPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const metadataPDA = getMetadataPDA(mintPubkey);

      const lamportsForMint = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

      // Build Transaction
      const transaction = new Transaction();

      // 1. Compute Budget
      if (priorityMicroLamports > 0) {
        transaction.add(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityMicroLamports,
          })
        );
      }
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 250000,
        })
      );

      // 2. Platform Fee Transfer (0.00 SOL for admin allowlist; 0.15 SOL bundled for public)
      const platformFeeLamports = Math.round(Number(platformFeeSol) * 1e9);
      if (platformFeeLamports > 0) {
        const treasuryPubkey = new PublicKey(values.treasury || DEFAULT_TREASURY_WALLET);
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: payerPubkey,
            toPubkey: treasuryPubkey,
            lamports: platformFeeLamports,
          })
        );
      }

      // 3. Create Mint Account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: payerPubkey,
          newAccountPubkey: mintPubkey,
          space: MINT_SIZE,
          lamports: lamportsForMint,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // 4. Initialize Mint
      transaction.add(
        createInitializeMintInstruction(
          mintPubkey,
          decimals,
          payerPubkey,
          payerPubkey,
          TOKEN_PROGRAM_ID
        )
      );

      // 5. Create Associated Token Account for Creator
      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          payerPubkey,
          userAta,
          payerPubkey,
          mintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      // 6. Mint 100% of Supply
      transaction.add(
        createMintToInstruction(
          mintPubkey,
          userAta,
          payerPubkey,
          rawSupply,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // 7. Metaplex Metadata V3
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
                address: payerPubkey,
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
          { pubkey: mintPubkey, isSigner: false, isWritable: false },
          { pubkey: payerPubkey, isSigner: true, isWritable: false },
          { pubkey: payerPubkey, isSigner: true, isWritable: true },
          { pubkey: payerPubkey, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        programId: METADATA_PROGRAM_ID,
        data: metadataInstructionData,
      });
      transaction.add(createMetadataAccountIx);

      // 8. Revoke Freeze Authority
      if (revokeFreeze) {
        transaction.add(
          createSetAuthorityInstruction(
            mintPubkey,
            payerPubkey,
            AuthorityType.FreezeAccount,
            null,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      // 9. Revoke Mint Authority
      if (revokeMint) {
        transaction.add(
          createSetAuthorityInstruction(
            mintPubkey,
            payerPubkey,
            AuthorityType.MintTokens,
            null,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      // Dry-Run Mode: verify exact transaction serialization and MTU limits without broadcasting
      if (values['dry-run']) {
        const dummyBlockhash = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM';
        transaction.recentBlockhash = dummyBlockhash;
        transaction.feePayer = payerPubkey;
        transaction.partialSign(mintKeypair);

        const serialized = transaction.serialize({ requireAllSignatures: false });
        if (serialized.length > 1232) {
          throw new Error(
            `Transaction size (${serialized.length} bytes) exceeds Solana MTU packet limit of 1232 bytes. Please shorten token name or metadata URI.`
          );
        }

        const clusterParam = isMainnet ? '' : `?cluster=${values.network}`;
        const result = {
          success: true,
          dryRun: true,
          network: values.network,
          rpcUrl,
          payer: payerPubkey.toBase58(),
          isAdmin,
          platformFeeSol,
          mintAddress: mintPubkey.toBase58(),
          userAta: userAta.toBase58(),
          name,
          symbol,
          decimals,
          supply: values.supply,
          rawSupply: rawSupply.toString(),
          metadataUri,
          revokeFreeze,
          revokeMint,
          immutable,
          serializedBytes: serialized.length,
          mtuLimitBytes: 1232,
          estimatedTotalSol: rent.estimatedTotalSol,
          instructionsCount: transaction.instructions.length,
          solscanUrl: `https://solscan.io/token/${mintPubkey.toBase58()}${clusterParam}`,
          rugcheckUrl: `https://rugcheck.xyz/tokens/${mintPubkey.toBase58()}`,
        };

        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`\n=== DRY RUN SIMULATION SUCCESSFUL ===`);
          console.log(`Token Name:        ${name} ($${symbol})`);
          console.log(`Decimals:          ${decimals}`);
          console.log(`Supply:            ${Number(values.supply).toLocaleString()} (Raw: ${rawSupply.toString()})`);
          console.log(`Metadata URI:      ${metadataUri}`);
          console.log(`Payer / Creator:   ${payerPubkey.toBase58()} (Admin: ${isAdmin ? 'YES • 0.00 SOL' : 'NO'})`);
          console.log(`Mint Address:      ${mintPubkey.toBase58()}`);
          console.log(`Creator ATA:       ${userAta.toBase58()}`);
          console.log(`Instructions:      ${transaction.instructions.length} atomic instructions`);
          console.log(`Transaction Size:  ${serialized.length} / 1232 MTU bytes`);
          console.log(`Revoke Freeze:     ${revokeFreeze ? 'YES' : 'NO'}`);
          console.log(`Revoke Mint:       ${revokeMint ? 'YES' : 'NO'}`);
          console.log(`Immutable:         ${immutable ? 'YES' : 'NO'}`);
          console.log(`Platform Fee:      ${platformFeeSol} SOL`);
          console.log(`Estimated Outlay:  ${rent.estimatedTotalSol} SOL`);
          console.log(`Solscan Explorer:  ${result.solscanUrl}`);
          console.log(`RugCheck Link:     ${result.rugcheckUrl}`);
          console.log(`\nSimulated clean transaction assembly with zero on-chain broadcast.\n`);
        }
        return;
      }

      // Live Deployment Execution
      if (!isJson) {
        console.log(`\nDeploying $${symbol} to Solana ${values.network}...`);
        console.log(`Payer: ${payerPubkey.toBase58()}`);
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payerPubkey;

      transaction.sign(payerKeypair, mintKeypair);

      const rawTx = transaction.serialize();
      if (rawTx.length > 1232) {
        throw new Error(`Transaction size (${rawTx.length} bytes) exceeds Solana MTU limit of 1232 bytes.`);
      }

      if (!isJson) {
        console.log(`Broadcasting transaction to ${rpcUrl}...`);
      }

      const signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      if (!isJson) {
        console.log(`Transaction broadcast: ${signature}`);
        console.log(`Waiting for on-chain confirmation...`);
      }

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
          throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
        }
      } catch (confirmErr) {
        const isConfirmed = await checkSignatureStatus(connection, signature);
        if (!isConfirmed) {
          throw new Error(
            `Transaction was broadcast with signature ${signature}, but confirmation timed out: ${confirmErr.message}.\n` +
            `Mint address: ${mintPubkey.toBase58()}.\n` +
            `Check Solscan before retrying to avoid duplicate deployments.`
          );
        }
      }

      const clusterParam = isMainnet ? '' : `?cluster=${values.network}`;
      const result = {
        success: true,
        network: values.network,
        rpcUrl,
        signature,
        mintAddress: mintPubkey.toBase58(),
        userAta: userAta.toBase58(),
        payer: payerPubkey.toBase58(),
        name,
        symbol,
        decimals,
        supply: values.supply,
        rawSupply: rawSupply.toString(),
        metadataUri,
        platformFeeSol,
        solscanUrl: `https://solscan.io/token/${mintPubkey.toBase58()}${clusterParam}`,
        txUrl: `https://solscan.io/tx/${signature}${clusterParam}`,
        rugcheckUrl: `https://rugcheck.xyz/tokens/${mintPubkey.toBase58()}`,
        raydiumUrl: isMainnet
          ? 'https://raydium.io/liquidity/create/'
          : 'https://raydium.io/liquidity/create/?cluster=devnet',
      };

      if (isJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n🎉 TOKEN CREATION SUCCESSFUL!`);
        console.log(`-----------------------------------------------`);
        console.log(`Token Name:   ${name} ($${symbol})`);
        console.log(`Mint Address: ${mintPubkey.toBase58()}`);
        console.log(`Creator ATA:  ${userAta.toBase58()}`);
        console.log(`Signature:    ${signature}`);
        console.log(`Explorer:     ${result.txUrl}`);
        console.log(`Solscan:      ${result.solscanUrl}`);
        console.log(`RugCheck:     ${result.rugcheckUrl}`);
        console.log(`Raydium LP:   ${result.raydiumUrl}\n`);
      }
    } catch (err) {
      if (isJson) {
        console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exitCode = 1;
    }
  }
}

run().catch((err) => {
  console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
  process.exitCode = 1;
});
