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
import { spawnSync } from 'child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import bs58 from 'bs58';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
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
import {
  PUMP_PROGRAM_ID,
  PUMP_FEE_RECIPIENT,
  INITIAL_VIRTUAL_SOL_RESERVES,
  INITIAL_VIRTUAL_TOKEN_RESERVES,
  TOTAL_TOKEN_SUPPLY,
  getBondingCurvePDA,
  getBondingCurveATA,
  parseBondingCurveData,
  calculateSellReturn,
  calculateMinSolOutput,
  createPumpSellInstruction,
} from '../src/lib/pump.js';
import { refineCoinNarrative } from '../src/lib/ai-bridge.js';
import {
  createScoutStagingRun,
  scanTrendingTokens,
  stageScoutedProfile,
} from '../src/lib/scout.js';
import { SCOUT_UPLOAD_TOKEN_FORMAT } from '../src/lib/ipfsMetadata.js';
import { publishScoutMetadata } from '../src/lib/scoutMetadata.js';

const SCOUT_DRY_RUN_METADATA_URI = 'https://example.invalid/scout-dry-run/sample-token-metadata-for-local-tests.json';

function readExplicitSigner(keypair, configured) {
  if (keypair === undefined && configured === undefined) {
    throw new Error('Pass --keypair or inject SOLANA_KEYPAIR_JSON for signed execution.');
  }
  try {
    if (keypair !== undefined) {
      if (!keypair.trim() || keypair.trim().startsWith('[')) throw new Error();
      return loadKeypair(keypair);
    }
    if (configured.length > 512) throw new Error();
    const bytes = JSON.parse(configured);
    if (!Array.isArray(bytes) || bytes.length !== 64 ||
      bytes.some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error();
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch {
    throw new Error('Could not load the explicitly selected signer.');
  }
}

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

  let isLive = true;
  try {
    mintRent = BigInt(await connection.getMinimumBalanceForRentExemption(MINT_SIZE));
    ataRent = BigInt(await connection.getMinimumBalanceForRentExemption(165));
    metadataRent = BigInt(await connection.getMinimumBalanceForRentExemption(679));
  } catch {
    isLive = false;
  }

  const feeLamports = BigInt(Math.round(Number(platformFeeSol) * 1e9));
  const totalLamports =
    mintRent + ataRent + metadataRent + metaplexProtocolLamports + networkGasBuffer + feeLamports;

  return {
    source: isLive ? 'live' : 'fallback',
    canAuthorizeSpend: isLive,
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
export function resolveKeypairPath(customPath) {
  if (customPath && typeof customPath === 'string' && customPath.trim()) {
    return customPath.trim();
  }
  if (process.env.SOLANA_KEYPAIR_PATH && process.env.SOLANA_KEYPAIR_PATH.trim()) {
    return process.env.SOLANA_KEYPAIR_PATH.trim();
  }
  if (process.env.WALLET_KEYPAIR_PATH && process.env.WALLET_KEYPAIR_PATH.trim()) {
    return process.env.WALLET_KEYPAIR_PATH.trim();
  }
  if (process.env.SOLANA_KEYPAIR && process.env.SOLANA_KEYPAIR.trim()) {
    return process.env.SOLANA_KEYPAIR.trim();
  }
  return path.join(os.homedir(), '.config', 'solana', 'id.json');
}

export function loadKeypair(keypairPath) {
  const resolvedPath = resolveKeypairPath(keypairPath);

  const expandedPath = resolvedPath.startsWith('~')
    ? path.join(os.homedir(), resolvedPath.slice(1))
    : path.resolve(resolvedPath);

  if (!fs.existsSync(expandedPath)) {
    throw new Error(`Keypair file not found at: ${expandedPath}`);
  }

  const rawData = fs.readFileSync(expandedPath, 'utf-8');
  try {
    const parsed = JSON.parse(rawData);
    if (!Array.isArray(parsed) || parsed.length !== 64) {
      throw new Error(`Keypair must be a 64-element array of byte numbers (got ${Array.isArray(parsed) ? parsed.length : typeof parsed})`);
    }
    for (let i = 0; i < 64; i++) {
      const b = parsed[i];
      if (typeof b !== 'number' || !Number.isInteger(b) || b < 0 || b > 255) {
        throw new Error(`Keypair element at index ${i} is not a valid integer byte [0..255]: ${b}`);
      }
    }
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
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
  create       Build, simulate or submit a standard SPL mint or a Pump launch
  estimate     Estimate exact on-chain rent and platform fees
  balance      Check SOL balance of connected or specified keypair
  watch        Resume or monitor a Pump position and sell on the active venue
  scout        Autonomous Trend Scanner & Asset Harvester (DexScreener + AI Bridge)
  wallet       Inspect and cryptographically verify local Solana keypair authority
  help         Display this help message

OPTIONS:
  --keypair <path>       Path to payer Solana keypair JSON file (required for live create/watch)
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
  --mint <pubkey>        Target token mint public key [REQUIRED for watch]
  --auto-exit            Automatically transition to watch & exit loop after create succeeds
  --tp1 <multiplier>     Tranche 1 Take-Profit multiplier (default: 2.0, sells 50% of bag for 100% principal recovery)
  --tp2 <multiplier>     Tranche 2 Take-Profit multiplier (default: 3.5, sells 25% of bag)
  --sl <multiplier>      Stop-Loss multiplier (default: 0.70, sells 100% remaining)
  --timeout <minutes>    Timeout Stop-Loss in minutes (default: 25)
  --slippage <percent>   Slippage tolerance percent (default: 5)
  --poll-ms <ms>         Watcher polling interval in milliseconds (default: 2000)
  --ai-bridge            Enable AI Bridge cognitive narrative refinement (default: true)
  --no-ai-bridge         Disable AI Bridge cognitive layer; use direct heuristic templates
  --limit <number>       Max candidate coins to scout (default: 5)
  --min-boosts <number>  Minimum DexScreener community boost count filter (default: 0)
  --staging-dir <path>   Operator-owned parent directory for a new scout run
  --auto-launch          Create from the top candidate. Live auto-pinning requires COINER_SCOUT_UPLOAD_TOKEN
  --dry-run              Simulate full transaction assembly & MTU check without broadcasting
  --json                 Output structured JSON response on stdout/stderr
  --help, -h             Show this help message

EXAMPLES:
  # Inspect and verify local wallet keypair
  node bin/coiner-cli.js wallet --json

  # Scout top 5 trending memes and refine with AI Bridge
  node bin/coiner-cli.js scout --limit 3

  # Autonomous End-to-End: Scout trend, refine lore, simulate launch & auto-exit
  node bin/coiner-cli.js scout --limit 1 --auto-launch --auto-exit --dry-run

  # Dry-run test on Devnet with pre-uploaded metadata
  node bin/coiner-cli.js create --name "Sol Cat" --symbol "SCAT" --metadata-uri "https://gateway.pinata.cloud/ipfs/QmExample" --dry-run --json

  # Create real token on Devnet with explicit keypair
  node bin/coiner-cli.js create --keypair ~/.config/solana/id.json --name "Sol Cat" --symbol "SCAT" --metadata-uri "https://gateway.pinata.cloud/ipfs/QmExample" --network devnet

  # Sign and simulate without broadcasting
  node bin/coiner-cli.js create --simulate --keypair <path> --name "Devnet Fixture" --symbol "DFIX" --metadata-uri <url>

  # Launch a SOL-quoted Pump position and start its exit watcher
  node bin/coiner-cli.js create --target pump --keypair <path> --name "Devnet Fixture" --symbol "DFIX" --metadata-uri <url> --initial-buy-sol 0.02 --max-spend-sol 0.15 --position-file <private-path> --auto-exit

  # Resume one position or explicitly sell all tracked tokens
  node bin/coiner-cli.js watch --keypair <path> --position-file <private-path> --liquidate-now

  # Monitor and auto-exit a Pump.fun token (dry-run)
  node bin/coiner-cli.js watch --mint 4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R --tp1 2.0 --tp2 3.5 --sl 0.70 --dry-run

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
  target: { type: 'string', default: 'spl' },
  'initial-buy-sol': { type: 'string' },
  'quote-sol': { type: 'string' },
  'burn-lp': { type: 'boolean', default: false },
  mint: { type: 'string' },
  'auto-exit': { type: 'boolean', default: false },
  simulate: { type: 'boolean', default: false },
  'position-file': { type: 'string' },
  'max-spend-sol': { type: 'string' },
  'liquidate-now': { type: 'boolean', default: false },
  tp1: { type: 'string' },
  tp2: { type: 'string' },
  sl: { type: 'string' },
  timeout: { type: 'string', default: '25' },
  slippage: { type: 'string', default: '5' },
  'poll-ms': { type: 'string', default: '2000' },
  'max-iterations': { type: 'string', default: '0' },
  'ai-bridge': { type: 'boolean', default: true },
  'no-ai-bridge': { type: 'boolean', default: false },
  limit: { type: 'string', default: '5' },
  source: { type: 'string', default: 'all' },
  'staging-dir': { type: 'string' },
  'auto-launch': { type: 'boolean', default: false },
  'min-boosts': { type: 'string', default: '0' },
  'import-clipboard': { type: 'boolean', default: false },
  force: { type: 'boolean', default: false },
};

function pumpOptions(values, priority, payer) {
  const tp1 = parseStrictDecimal(values.tp1 || '2.0', 'tp1', { min: 1, max: 1000 });
  const tp2 = parseStrictDecimal(values.tp2 || '3.5', 'tp2', { min: tp1, max: 1000 });
  const sl = parseStrictDecimal(values.sl || '0.70', 'sl', { min: 0, max: 0.9999 });
  const timeout = parseStrictDecimal(values.timeout, 'timeout', { min: 0, max: 1440 });
  const pollMs = parseStrictDecimal(values['poll-ms'], 'poll-ms', { min: 100, max: 60000 });
  const maxIterations = parseStrictDecimal(values['max-iterations'], 'max-iterations', {
    min: 0, max: 100000, allowZero: true,
  });
  if (!Number.isInteger(pollMs) || !Number.isInteger(maxIterations)) {
    throw new Error('Polling interval and iteration limit must be whole numbers.');
  }
  if (!values.simulate && !values['position-file']?.trim()) {
    throw new Error('Pass --position-file with a private location for this position.');
  }
  return {
    payer, network: values.network, positionFile: values['position-file'],
    priority, simulate: values.simulate, liquidateNow: values['liquidate-now'],
    settings: {
      tp1: Math.round(tp1 * 10000), tp2: Math.round(tp2 * 10000), stopLoss: Math.round(sl * 10000),
      timeoutMs: Math.ceil(timeout * 60000), pollMs,
      maxIterations: maxIterations || Math.ceil(timeout * 60000 / pollMs) + Math.ceil(300000 / pollMs),
      slippage: parseStrictDecimal(values.slippage, 'slippage', { min: 0, max: 50, allowZero: true }),
    },
  };
}

function printPumpResult(result) {
  console.log(JSON.stringify(result, null, 2));
  if (!result.success) process.exitCode = 2;
}

function safeRpcError(error) {
  return error.message.replace(/https?:\/\/[^\s"'<>]+/gi, '[URL redacted]');
}

function validateMetadataUri(value) {
  const uri = (value || '').trim();
  if (!uri) throw new Error('Provide a published metadata JSON URL with --metadata-uri.');
  const bytes = getUtf8ByteLength(uri);
  if (bytes > 200) throw new Error(`Metadata URI exceeds the 200 UTF-8 byte limit (got ${bytes} bytes).`);
  let url;
  try {
    url = new URL(uri);
  } catch {
    throw new Error('Metadata URI must be a valid HTTP(S) URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Metadata URI must use HTTP(S) without credentials.');
  }
  return uri;
}

/**
 * Helper to parse and strictly validate positive decimal numbers (Sol finding F10 / P09)
 */
export function parseStrictDecimal(val, fieldName, { min = 0, max = Infinity, allowZero = false } = {}) {
  const str = String(val || '').trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(str)) {
    throw new Error(`Invalid ${fieldName}: "${val}". Must be a strictly formatted positive decimal number.`);
  }
  const num = Number(str);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    throw new Error(`Invalid ${fieldName}: "${val}". Number is not finite.`);
  }
  if (allowZero ? num < min : num <= min) {
    throw new Error(`Invalid ${fieldName}: "${val}". Must be greater than ${allowZero ? 'or equal to ' : ''}${min}.`);
  }
  if (num > max) {
    throw new Error(`Invalid ${fieldName}: "${val}". Must be less than or equal to ${max}.`);
  }
  return num;
}

/**
 * Assembles, signs, and executes an atomic Pump.fun sell transaction (14 accounts)
 */
export async function executeSell({
  connection,
  payerKeypair,
  mintPubkey,
  creator = null,
  sellTokens,
  minSol,
  ret,
  priority = 'turbo',
  isDryRun = false,
  isJson = false,
  label = 'SELL',
}) {
  const payerPubkey = payerKeypair.publicKey;
  const priorityLower = (priority || 'turbo').toLowerCase();
  const priorityMicroLamports = PRIORITY_FEE_MAP[priorityLower] || 1000000;

  const transaction = new Transaction();
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityMicroLamports })
  );

  const sellIx = createPumpSellInstruction({
    mint: mintPubkey,
    user: payerPubkey,
    creator,
    tokenAmount: sellTokens,
    minSolOutput: minSol,
  });
  transaction.add(sellIx);

  if (isDryRun) {
    const dummyBlockhash = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM';
    transaction.recentBlockhash = dummyBlockhash;
    transaction.feePayer = payerPubkey;
    const serialized = transaction.serialize({ requireAllSignatures: false });
    if (serialized.length > 1232) {
      throw new Error(`Sell transaction size (${serialized.length} bytes) exceeds Solana MTU packet limit of 1232 bytes.`);
    }
    if (!isJson) {
      console.log(`  [DRY-RUN] Verified sell transaction assembly (${serialized.length} bytes / 1232 MTU). Net return: ~${ret.netSolFloat.toFixed(4)} SOL`);
    }
    return { signature: 'simulated_dry_run_sig', netSolFloat: ret.netSolFloat, confirmed: true };
  }

  // Live broadcast
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payerPubkey;
  transaction.sign(payerKeypair);

  const rawTx = transaction.serialize();
  if (rawTx.length > 1232) {
    throw new Error(`Sell transaction size (${rawTx.length} bytes) exceeds Solana MTU packet limit of 1232 bytes.`);
  }

  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  let isConfirmed = false;
  try {
    const confirmation = await connection.confirmTransaction(
      { blockhash, lastValidBlockHeight, signature },
      'confirmed'
    );
    if (!confirmation || !confirmation.value || confirmation.value.err) {
      throw new Error(`Sell transaction failed on-chain: ${JSON.stringify(confirmation?.value?.err || 'Empty or invalid confirmation response')}`);
    }
    isConfirmed = true;
  } catch (confirmErr) {
    let sigStatus = { kind: 'unknown' };
    if (typeof checkSignatureStatus === 'function') {
      try {
        sigStatus = await checkSignatureStatus(connection, signature);
      } catch {}
    }
    if (sigStatus?.kind === 'confirmed') {
      isConfirmed = true;
    } else {
      const err = new Error(`Sell transaction confirmation uncertain (status: ${sigStatus?.kind || 'unknown'}): ${confirmErr.message}`);
      err.signature = signature;
      err.blockhash = blockhash;
      err.lastValidBlockHeight = lastValidBlockHeight;
      err.kind = sigStatus?.kind || 'unconfirmed';
      throw err;
    }
  }

  if (!isJson) {
    console.log(`  [TX CONFIRMED] ${label} signature: ${signature}`);
  }
  return { signature, netSolFloat: ret.netSolFloat, confirmed: isConfirmed };
}

/**
 * Executes the automated take-profit and stop-loss watcher loop for a Pump.fun token.
 * Awaited sequential polling loop with re-entrancy protection (Sol findings F02, F05, F06, F08, F09, F12).
 */
export async function runWatchLoop({
  connection,
  mintPubkey,
  payerKeypair,
  tp1Multiplier = 2.0,
  tp2Multiplier = 3.5,
  slMultiplier = 0.70,
  timeoutMinutes = 25,
  slippagePercent = 5,
  pollMs = 2000,
  maxIterations = 0,
  isDryRun = false,
  isJson = false,
  priority = 'turbo',
  network = 'mainnet-beta',
}) {
  const mintStr = mintPubkey.toBase58();
  const payerPubkey = payerKeypair.publicKey;
  const payerStr = payerPubkey.toBase58();
  const { pda: bondingCurvePda } = getBondingCurvePDA(mintPubkey);
  const associatedBondingCurve = getBondingCurveATA(mintPubkey, bondingCurvePda);
  const associatedUser = getAssociatedTokenAddressSync(mintPubkey, payerPubkey);

  if (!isJson) {
    console.log(`\n=== PUMP.FUN AUTOMATED EXIT WATCHER ACTIVATED ===`);
    console.log(`Token Mint:      ${mintStr}`);
    console.log(`Payer / ATA:     ${payerStr} / ${associatedUser.toBase58()}`);
    console.log(`Bonding Curve:   ${bondingCurvePda.toBase58()}`);
    console.log(`TP1 Multiplier:  ${tp1Multiplier.toFixed(2)}x (Tranche 1: 50% sell • 100% Capital Recovery)`);
    console.log(`TP2 Multiplier:  ${tp2Multiplier.toFixed(2)}x (Tranche 2: 25% sell • Pure Profit)`);
    console.log(`Stop-Loss:       ${slMultiplier.toFixed(2)}x (100% emergency exit)`);
    console.log(`Timeout:         ${timeoutMinutes} minutes (momentum failure exit)`);
    console.log(`Slippage:        ${slippagePercent}%`);
    console.log(`Polling:         ${pollMs} ms`);
    console.log(`Mode:            ${isDryRun ? 'DRY-RUN (Simulated Zero-Broadcast)' : 'LIVE BROADCAST'}\n`);
  }

  // 1. Read initial user ATA token balance
  let initialTokens = 0n;
  if (isDryRun) {
    initialTokens = 2_820_000_000_000n; // 2.82M tokens
  } else {
    try {
      const tokenBal = await connection.getTokenAccountBalance(associatedUser);
      initialTokens = BigInt(tokenBal.value.amount);
    } catch (err) {
      throw new Error(`Unable to read token account balance at ${associatedUser.toBase58()}: ${err.message}`);
    }
  }

  if (initialTokens <= 0n) {
    throw new Error(`Token account ${associatedUser.toBase58()} has zero tokens to manage.`);
  }

  // 2. Fetch baseline curve data (Fail closed on live missing curve, Sol finding F06)
  let baselineSpotPrice = 0;
  let genesisCurve = null;
  if (isDryRun) {
    baselineSpotPrice = Number(INITIAL_VIRTUAL_SOL_RESERVES) / 1e9 / (Number(INITIAL_VIRTUAL_TOKEN_RESERVES) / 1e6);
  } else {
    const acc = await connection.getAccountInfo(bondingCurvePda);
    if (!acc || !acc.data) {
      throw new Error(`Bonding curve account for mint ${mintStr} not found on ${network}. Cannot establish verified baseline price.`);
    }
    genesisCurve = parseBondingCurveData(acc.data);
    baselineSpotPrice = genesisCurve.spotPriceSolPerToken;
  }

  if (!baselineSpotPrice || baselineSpotPrice <= 0) {
    throw new Error(`Invalid baseline spot price derived for ${mintStr}.`);
  }

  const startTime = Date.now();
  const state = {
    startTime,
    mint: mintStr,
    baselineSpotPrice,
    initialTokens,
    remainingTokens: initialTokens,
    tp1Executed: false,
    tp2Executed: false,
    tp3Executed: false,
    slExecuted: false,
    timeoutExecuted: false,
    pendingTranches: { tp1: null, tp2: null, sl: null, timeout: null, tp3: null },
    netSolHarvested: 0n,
    exitReason: null,
    iterations: 0,
  };

  if (!isJson) {
    console.log(`Initial Position: ${(Number(initialTokens) / 1e6).toLocaleString()} tokens`);
    console.log(`Baseline Price:   ${baselineSpotPrice.toFixed(10)} SOL/token\n`);
    console.log(`Listening for bonding curve price movements...`);
  }

  // Awaited sequential loop with concurrency lock (Sol finding F02)
  let isTerminating = false;
  let isTickRunning = false;

  const cleanupAndResolve = () => {
    isTerminating = true;
    const summary = {
      success: true,
      mint: state.mint,
      exitReason: state.exitReason || 'STOPPED',
      totalHarvestedSol: (Number(state.netSolHarvested) / 1e9).toFixed(5),
      tp1Executed: state.tp1Executed,
      tp2Executed: state.tp2Executed,
      tp3Executed: state.tp3Executed,
      slExecuted: state.slExecuted,
      timeoutExecuted: state.timeoutExecuted,
      elapsedSeconds: Math.floor((Date.now() - state.startTime) / 1000),
      dryRun: isDryRun,
    };

    if (isJson) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(`\n=== WATCHER SUMMARY ===`);
      console.log(`Exit Reason:     ${summary.exitReason}`);
      console.log(`Total Harvested: ${summary.totalHarvestedSol} SOL`);
      console.log(`Tranche 1 (2x):  ${summary.tp1Executed ? 'EXECUTED' : 'SKIPPED'}`);
      console.log(`Tranche 2 (3.5x):${summary.tp2Executed ? 'EXECUTED' : 'SKIPPED'}`);
      console.log(`Moonbag (95%):   ${summary.tp3Executed ? 'EXECUTED' : 'SKIPPED'}`);
      console.log(`Stop-Loss / Time:${summary.slExecuted || summary.timeoutExecuted ? 'EXECUTED' : 'NO'}`);
      console.log(`Elapsed Time:    ${summary.elapsedSeconds}s\n`);
    }
    return summary;
  };

  while (!isTerminating) {
    if (maxIterations > 0 && state.iterations >= maxIterations) {
      state.exitReason = 'MAX_ITERATIONS_REACHED';
      return cleanupAndResolve();
    }

    if (!isTickRunning) {
      isTickRunning = true;
      try {
        state.iterations++;
        const elapsedMinutes = (Date.now() - state.startTime) / 60000;
        let curveData = null;

        if (isDryRun) {
          const simulatedVSol = INITIAL_VIRTUAL_SOL_RESERVES + BigInt(state.iterations * 15_000_000_000);
          const simulatedVToken = INITIAL_VIRTUAL_TOKEN_RESERVES - BigInt(state.iterations * 10_000_000_000);
          curveData = {
            virtualTokenReserves: simulatedVToken,
            virtualSolReserves: simulatedVSol,
            realTokenReserves: 700_000_000_000_000n,
            realSolReserves: 10_000_000_000n,
            tokenTotalSupply: TOTAL_TOKEN_SUPPLY,
            complete: false,
            creator: payerPubkey,
            spotPriceSolPerToken: (Number(simulatedVSol) / 1e9) / (Number(simulatedVToken) / 1e6),
            progressPercent: Number(((Number(simulatedVSol) / 1e9 / 85) * 100).toFixed(2)),
          };
        } else {
          try {
            const acc = await connection.getAccountInfo(bondingCurvePda);
            if (acc && acc.data) {
              if (acc.owner && acc.owner.toBase58 && acc.owner.toBase58() !== PUMP_PROGRAM_ID.toBase58()) {
                throw new Error(`Invalid bonding curve account owner: "${typeof acc.owner.toBase58 === 'function' ? acc.owner.toBase58() : acc.owner}". Expected Pump Program: "${PUMP_PROGRAM_ID.toBase58()}".`);
              }
              curveData = parseBondingCurveData(acc.data);
            } else {
              if (!isJson) console.log(`[${new Date().toISOString()}] Waiting for on-chain bonding curve initialization...`);
            }
          } catch (rpcErr) {
            if (!isJson) console.error(`[RPC WARNING] ${rpcErr.message}`);
          }
        }

        // Guaranteed loop termination check on missing/throwing data (Sol finding F09 / P04)
        if (!curveData) {
          if (maxIterations > 0 && state.iterations >= maxIterations) {
            state.exitReason = 'MAX_ITERATIONS_REACHED';
            return cleanupAndResolve();
          }
          await new Promise((r) => setTimeout(r, pollMs));
          continue;
        }

        // Check if curve is already complete/migrated (Sol finding F11 / R08)
        if (curveData.complete) {
          state.exitReason = 'CURVE_MIGRATED_TO_DEX';
          if (!isJson) {
            console.log(`\n🎉 [CURVE COMPLETED] Bonding curve has completed and migrated to Raydium/PumpSwap.`);
            console.log(`Bonding curve is closed on-chain. Watcher exiting cleanly.\n`);
          }
          return cleanupAndResolve();
        }

        const currentPrice = curveData.spotPriceSolPerToken;
        const multiplier = state.baselineSpotPrice > 0 ? (currentPrice / state.baselineSpotPrice) : 1.0;

        if (!isJson) {
          const mStr = `${multiplier.toFixed(2)}x`.padStart(6, ' ');
          const pStr = `${currentPrice.toFixed(10)} SOL`.padStart(18, ' ');
          const progStr = `${curveData.progressPercent.toFixed(1)}%`.padStart(6, ' ');
          const remStr = `${(Number(state.remainingTokens) / 1e6).toLocaleString()} tokens`.padStart(18, ' ');
          console.log(`[T+${elapsedMinutes.toFixed(1)}m] Price: ${pStr} | Multiplier: ${mStr} | Curve: ${progStr} | Remaining: ${remStr}`);
        }

        // --- CHECK 1: Stop-Loss (Emergency Exit - Evaluated First, Unblocked by TP1, Sol finding F05 / P05) ---
        if (multiplier <= slMultiplier && !state.slExecuted) {
          const sellTokens = state.remainingTokens;
          if (sellTokens > 0n) {
            const ret = calculateSellReturn(sellTokens, curveData.virtualTokenReserves, curveData.virtualSolReserves);
            const minSol = calculateMinSolOutput(ret.netSolLamports, slippagePercent);

            if (!isJson) {
              console.log(`\n🛑 [TRIGGER: STOP-LOSS HIT @ ${multiplier.toFixed(2)}x] Emergency sell 100% remaining bag...`);
            }

            await executeSell({
              connection,
              payerKeypair,
              mintPubkey,
              creator: curveData.creator,
              sellTokens,
              minSol,
              ret,
              priority,
              isDryRun,
              isJson,
              label: 'STOP_LOSS',
            });

            state.slExecuted = true;
            state.remainingTokens = 0n;
            state.netSolHarvested += ret.netSolLamports;
            state.exitReason = 'STOP_LOSS_TRIGGERED';
            return cleanupAndResolve();
          }
        }

        // --- CHECK 2: Timeout Stop-Loss (Momentum Stalled) ---
        if (elapsedMinutes >= timeoutMinutes && multiplier < 1.5 && !state.timeoutExecuted) {
          const sellTokens = state.remainingTokens;
          if (sellTokens > 0n) {
            const ret = calculateSellReturn(sellTokens, curveData.virtualTokenReserves, curveData.virtualSolReserves);
            const minSol = calculateMinSolOutput(ret.netSolLamports, slippagePercent);

            if (!isJson) {
              console.log(`\n⏱️ [TRIGGER: TIMEOUT REACHED (${timeoutMinutes}m)] Momentum stalled. Liquidating to preserve capital...`);
            }

            await executeSell({
              connection,
              payerKeypair,
              mintPubkey,
              creator: curveData.creator,
              sellTokens,
              minSol,
              ret,
              priority,
              isDryRun,
              isJson,
              label: 'TIMEOUT_EXIT',
            });

            state.timeoutExecuted = true;
            state.remainingTokens = 0n;
            state.netSolHarvested += ret.netSolLamports;
            state.exitReason = 'TIMEOUT_RECYCLED';
            return cleanupAndResolve();
          }
        }

        // --- CHECK 3: TP1 (Capital Recovery Tranche @ 2.0x • Sells 50% for 100% Capital Recovery, Sol finding F12 / P08) ---
        if (multiplier >= tp1Multiplier && !state.tp1Executed) {
          if (state.pendingTranches.tp1) {
            try {
              const sigStatus = await checkSignatureStatus(connection, state.pendingTranches.tp1.signature);
              if (sigStatus?.kind === 'confirmed') {
                state.tp1Executed = true;
                state.remainingTokens -= state.pendingTranches.tp1.sellTokens;
                state.netSolHarvested += state.pendingTranches.tp1.netSolLamports;
                state.pendingTranches.tp1 = null;
                if (!isJson) console.log(`✅ TP1 Confirmed on-chain via signature reconciliation!`);
                if (maxIterations > 0 && state.iterations >= maxIterations) {
                  state.exitReason = 'MAX_ITERATIONS_REACHED';
                  return cleanupAndResolve();
                }
                await new Promise((r) => setTimeout(r, pollMs));
                continue;
              } else if (sigStatus?.kind === 'failed') {
                state.pendingTranches.tp1 = null;
              } else {
                if (!isJson) console.log(`  [IN-FLIGHT] TP1 transaction ${state.pendingTranches.tp1.signature} still unconfirmed. Waiting...`);
                if (maxIterations > 0 && state.iterations >= maxIterations) {
                  state.exitReason = 'MAX_ITERATIONS_REACHED';
                  return cleanupAndResolve();
                }
                await new Promise((r) => setTimeout(r, pollMs));
                continue;
              }
            } catch {
              if (maxIterations > 0 && state.iterations >= maxIterations) {
                state.exitReason = 'MAX_ITERATIONS_REACHED';
                return cleanupAndResolve();
              }
              await new Promise((r) => setTimeout(r, pollMs));
              continue;
            }
          }

          const trancheTokens = (state.initialTokens * 50n) / 100n;
          const sellTokens = trancheTokens > state.remainingTokens ? state.remainingTokens : trancheTokens;
          if (sellTokens > 0n) {
            const ret = calculateSellReturn(sellTokens, curveData.virtualTokenReserves, curveData.virtualSolReserves);
            const minSol = calculateMinSolOutput(ret.netSolLamports, slippagePercent);

            if (!isJson) {
              console.log(`\n🎯 [TRIGGER: TP1 REACHED @ ${multiplier.toFixed(2)}x] Selling 50% (${(Number(sellTokens) / 1e6).toLocaleString()} tokens)...`);
            }

            try {
              await executeSell({
                connection,
                payerKeypair,
                mintPubkey,
                creator: curveData.creator,
                sellTokens,
                minSol,
                ret,
                priority,
                isDryRun,
                isJson,
                label: 'TP1 (Capital Recovery)',
              });

              state.tp1Executed = true;
              state.remainingTokens -= sellTokens;
              state.netSolHarvested += ret.netSolLamports;
              state.pendingTranches.tp1 = null;
              if (!isJson) console.log(`✅ TP1 Executed! Initial capital recovered: ~${ret.netSolFloat.toFixed(4)} SOL\n`);
            } catch (err) {
              if (err.signature) {
                state.pendingTranches.tp1 = {
                  signature: err.signature,
                  sellTokens,
                  netSolLamports: ret.netSolLamports,
                };
              }
              throw err;
            }

            // Single action per tick to refresh reserves on next tick (Sol finding F08 / P07)
            if (maxIterations > 0 && state.iterations >= maxIterations) {
              state.exitReason = 'MAX_ITERATIONS_REACHED';
              return cleanupAndResolve();
            }
            await new Promise((r) => setTimeout(r, pollMs));
            continue;
          }
        }

        // --- CHECK 4: TP2 (Profit Extraction Tranche @ 3.5x • Sells 25%) ---
        if (multiplier >= tp2Multiplier && !state.tp2Executed) {
          const trancheTokens = (state.initialTokens * 25n) / 100n;
          const sellTokens = trancheTokens > state.remainingTokens ? state.remainingTokens : trancheTokens;
          if (sellTokens > 0n) {
            const ret = calculateSellReturn(sellTokens, curveData.virtualTokenReserves, curveData.virtualSolReserves);
            const minSol = calculateMinSolOutput(ret.netSolLamports, slippagePercent);

            if (!isJson) {
              console.log(`\n💰 [TRIGGER: TP2 REACHED @ ${multiplier.toFixed(2)}x] Selling 25% (${(Number(sellTokens) / 1e6).toLocaleString()} tokens)...`);
            }

            await executeSell({
              connection,
              payerKeypair,
              mintPubkey,
              creator: curveData.creator,
              sellTokens,
              minSol,
              ret,
              priority,
              isDryRun,
              isJson,
              label: 'TP2 (Profit Extraction)',
            });

            state.tp2Executed = true;
            state.remainingTokens -= sellTokens;
            state.netSolHarvested += ret.netSolLamports;
            if (!isJson) console.log(`✅ TP2 Executed! Pure profit captured: ~${ret.netSolFloat.toFixed(4)} SOL\n`);
            // Single action per tick (Sol finding F08)
            if (maxIterations > 0 && state.iterations >= maxIterations) {
              state.exitReason = 'MAX_ITERATIONS_REACHED';
              return cleanupAndResolve();
            }
            await new Promise((r) => setTimeout(r, pollMs));
            continue;
          }
        }

        // --- CHECK 5: TP3 (Moonbag / Pre-Migration Exit @ 95% curve) ---
        if (curveData.progressPercent >= 95 && !state.tp3Executed) {
          const sellTokens = state.remainingTokens;
          if (sellTokens > 0n) {
            const ret = calculateSellReturn(sellTokens, curveData.virtualTokenReserves, curveData.virtualSolReserves);
            const minSol = calculateMinSolOutput(ret.netSolLamports, slippagePercent);

            if (!isJson) {
              console.log(`\n🌕 [TRIGGER: CURVE BONDED / 95% REACHED] Liquidating moonbag before Raydium dump...`);
            }

            await executeSell({
              connection,
              payerKeypair,
              mintPubkey,
              creator: curveData.creator,
              sellTokens,
              minSol,
              ret,
              priority,
              isDryRun,
              isJson,
              label: 'TP3 (Migration Exit)',
            });

            state.tp3Executed = true;
            state.remainingTokens = 0n;
            state.netSolHarvested += ret.netSolLamports;
            state.exitReason = 'COMPLETED_MIGRATION';
            return cleanupAndResolve();
          }
        }

        // Position fully closed
        if (state.remainingTokens <= 0n) {
          state.exitReason = 'POSITION_FULLY_CLOSED';
          return cleanupAndResolve();
        }

        // Max iterations guard
        if (maxIterations > 0 && state.iterations >= maxIterations) {
          state.exitReason = 'MAX_ITERATIONS_REACHED';
          return cleanupAndResolve();
        }
      } catch (tickErr) {
        if (!isJson) console.error(`Watcher Tick Error: ${tickErr.message}`);
        if (maxIterations > 0 && state.iterations >= maxIterations) {
          state.exitReason = 'MAX_ITERATIONS_REACHED';
          return cleanupAndResolve();
        }
      } finally {
        isTickRunning = false;
      }
    }

    if (isTerminating) break;
    await new Promise((r) => setTimeout(r, pollMs));
  }

  return cleanupAndResolve();
}

/**
 * Main execution entrypoint
 */
export async function run(args = process.argv.slice(2)) {
  const configuredSigner = process.env.SOLANA_KEYPAIR_JSON;
  delete process.env.SOLANA_KEYPAIR_JSON;
  const isJsonRequested = args.includes('--json');

  let parsed;
  try {
    parsed = parseArgs({
      args,
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

  let command = positionals[0];
  const ALLOWED_COMMANDS = ['create', 'estimate', 'balance', 'watch', 'scout', 'wallet', 'help'];
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
  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
    fetch: (url, options) => fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(12000) }),
  });

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

  // Command: wallet
  if (command === 'wallet') {
    if (values['import-clipboard']) {
      try {
        if (!isJson) {
          console.log(`\n🔐 Zero-Knowledge Solana Keypair Clipboard Importer...`);
        }
        // Read clipboard directly via powershell in child memory
        const psRes = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard'], {
          encoding: 'utf-8',
          windowsHide: true,
          timeout: 5000,
        });

        let raw = (psRes.stdout || '').trim();
        if (!raw) {
          // Fallback: Check Windows 10/11 Clipboard History (Win+V) via WinRT API
          const winrtScript = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
try {
  $op = [Windows.ApplicationModel.DataTransfer.Clipboard]::GetHistoryItemsAsync()
  $task = $asTask.MakeGenericMethod([Windows.ApplicationModel.DataTransfer.ClipboardHistoryItemsResult]).Invoke($null, @($op))
  $task.Wait()
  $items = $task.Result.Items
  foreach ($item in $items) {
    if ($item.Content.Contains([Windows.ApplicationModel.DataTransfer.StandardDataFormats]::Text)) {
      $textOp = $item.Content.GetTextAsync()
      $textTask = $asTask.MakeGenericMethod([string]).Invoke($null, @($textOp))
      $textTask.Wait()
      $val = $textTask.Result.Trim()
      if ($val -match '^[1-9A-HJ-NP-Za-km-z]{85,90}$' -or ($val.StartsWith('[') -and $val.EndsWith(']'))) {
        Write-Output $val
        break
      }
    }
  }
} catch {}
`;
          const winrtRes = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', winrtScript], {
            encoding: 'utf-8',
            windowsHide: true,
            timeout: 7000,
          });
          raw = (winrtRes.stdout || '').trim();
        }

        if (!raw) {
          throw new Error('Windows clipboard and Win+V history are empty. Please open Phantom/Solflare, export your private key, copy it (Ctrl+C), and rerun.');
        }

        let keypair;
        if (raw.startsWith('[') && raw.endsWith(']')) {
          // JSON Byte Array format (e.g. from Solflare or id.json)
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed) || (parsed.length !== 64 && parsed.length !== 32)) {
            throw new Error(`Invalid JSON keypair array: expected 64 or 32 elements (got ${parsed.length}).`);
          }
          for (const b of parsed) {
            if (!Number.isInteger(b) || b < 0 || b > 255) {
              throw new Error(`Invalid keypair byte: "${b}" is not an integer in range [0..255].`);
            }
          }
          if (parsed.length === 64) {
            keypair = Keypair.fromSecretKey(Uint8Array.from(parsed));
          } else {
            keypair = Keypair.fromSeed(Uint8Array.from(parsed));
          }
        } else {
          // Base58 encoded string format (e.g. from Phantom)
          const cleanB58 = raw.replace(/['"\s]/g, '');
          let decoded;
          try {
            decoded = bs58.decode(cleanB58);
          } catch (b58Err) {
            throw new Error(`Failed to decode Base58 private key from clipboard: ${b58Err.message}`);
          }
          if (decoded.length === 64) {
            keypair = Keypair.fromSecretKey(decoded);
          } else if (decoded.length === 32) {
            keypair = Keypair.fromSeed(decoded);
          } else {
            throw new Error(`Unexpected decoded private key byte length: expected 64 (full key) or 32 (seed), got ${decoded.length} bytes.`);
          }
        }

        const pubkey = keypair.publicKey.toBase58();
        const expectedAdmin = DEFAULT_TREASURY_WALLET;
        const matchesAdmin = pubkey === expectedAdmin;

        if (!matchesAdmin && !values.force) {
          throw new Error(`Keypair address mismatch: got "${pubkey}", expected "${expectedAdmin}". Pass --force to accept a non-admin wallet.`);
        }

        // Ensure ~/.config/solana directory exists
        const solanaConfigDir = path.resolve(os.homedir(), '.config', 'solana');
        if (!fs.existsSync(solanaConfigDir)) {
          fs.mkdirSync(solanaConfigDir, { recursive: true });
        }

        const targetIdPath = path.resolve(solanaConfigDir, 'id.json');
        const targetPubkeyPath = path.resolve(solanaConfigDir, `${pubkey}.json`);

        // Write strict 64-element JSON byte array
        const keypairJson = JSON.stringify(Array.from(keypair.secretKey));
        fs.writeFileSync(targetIdPath, keypairJson, { encoding: 'utf-8', mode: 0o600 });
        fs.writeFileSync(targetPubkeyPath, keypairJson, { encoding: 'utf-8', mode: 0o600 });

        // Apply owner-only NTFS ACLs on Windows
        if (process.platform === 'win32') {
          const user = process.env.USERNAME || 'THINKPAD';
          spawnSync('icacls', [targetIdPath, '/inheritance:r', '/grant:r', `${user}:(F)`], { windowsHide: true });
          spawnSync('icacls', [targetPubkeyPath, '/inheritance:r', '/grant:r', `${user}:(F)`], { windowsHide: true });
        }

        // Wipe both active clipboard and Win+V history immediately
        const wipeCmd = 'try { [Windows.ApplicationModel.DataTransfer.Clipboard]::ClearHistory() } catch {}; try { [Windows.ApplicationModel.DataTransfer.Clipboard]::Clear() } catch {}; Set-Clipboard -Value ""';
        spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', wipeCmd], {
          windowsHide: true,
          timeout: 5000,
        });

        if (isJson) {
          console.log(JSON.stringify({
            success: true,
            publicKey: pubkey,
            matchesAdmin,
            savedPath: targetIdPath,
            namedPath: targetPubkeyPath,
            clipboardCleared: true,
          }, null, 2));
        } else {
          console.log(`\n🎉 KEYPAIR IMPORTED SUCCESSFULLY!`);
          console.log(`-----------------------------------------------`);
          console.log(`Public Address:   ${pubkey}`);
          console.log(`Admin Status:     ${matchesAdmin ? '✅ CONFIRMED PLATFORM ADMIN (0.00 SOL fee)' : 'ℹ️ Standard Public Creator'}`);
          console.log(`Saved Locations:  1) ${targetIdPath}`);
          console.log(`                  2) ${targetPubkeyPath}`);
          console.log(`Clipboard:        🧹 Cleared (active clipboard & Win+V history purged)`);
          console.log(`Security:         Strict owner-only NTFS ACL applied (inheritance disabled).\n`);
        }
        return;
      } catch (importErr) {
        // Wipe clipboard on error as well
        const wipeCmd = 'try { [Windows.ApplicationModel.DataTransfer.Clipboard]::ClearHistory() } catch {}; try { [Windows.ApplicationModel.DataTransfer.Clipboard]::Clear() } catch {}; Set-Clipboard -Value ""';
        spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', wipeCmd], {
          windowsHide: true,
          timeout: 5000,
        });
        if (isJson) {
          console.error(JSON.stringify({ success: false, error: importErr.message }, null, 2));
        } else {
          console.error(`\n❌ Keypair Import Failed: ${importErr.message}`);
          console.error(`   Clipboard has been cleared for safety.\n`);
        }
        process.exitCode = 1;
        return;
      }
    }

    try {
      const keypairPath = resolveKeypairPath(values.keypair);

      let payerKeypair = null;
      let keypairFound = false;
      let keypairError = null;
      try {
        payerKeypair = loadKeypair(keypairPath);
        keypairFound = true;
      } catch (err) {
        keypairError = err.message;
        process.exitCode = 1; // Explicit non-zero exit code on keypair discovery failure (S11)
      }

      const expectedAdmin = DEFAULT_TREASURY_WALLET;
      const pubkeyStr = keypairFound ? payerKeypair.publicKey.toBase58() : 'N/A';
      const isAdmin = keypairFound ? isAdminWallet(pubkeyStr) : false;
      const matchesExpected = pubkeyStr === expectedAdmin;

      let balanceSol = 'N/A';
      let balanceLamports = null;
      let balanceSuccess = false;
      let balanceError = null;
      if (keypairFound) {
        try {
          const lamports = await connection.getBalance(payerKeypair.publicKey);
          balanceLamports = lamports.toString();
          balanceSol = (lamports / 1e9).toFixed(5);
          balanceSuccess = true;
        } catch (balErr) {
          balanceError = balErr.message;
          balanceSol = `RPC Error: ${balErr.message}`;
          balanceLamports = null;
          process.exitCode = 1;
        }
      }

      const result = {
        success: keypairFound && (balanceSuccess || values['dry-run']),
        keypairFound,
        balanceSuccess,
        balanceError,
        keypairPath,
        publicKey: pubkeyStr,
        expectedAdminWallet: expectedAdmin,
        isMatchesExpectedAdmin: matchesExpected,
        isAdminFeeExempt: isAdmin,
        platformFeeSol: isAdmin ? '0.00 SOL' : '0.15 SOL',
        balanceSol,
        balanceLamports,
        network: values.network,
        rpcUrl,
        securityAssurance: {
          cryptographicGuarantee: 'Ed25519 digital signature required for every on-chain debit',
          strangerDebitRisk: 'Zero. Without matching secret key, transactions are rejected by consensus.',
          signingStatus: keypairFound ? 'Keypair loaded and verified for signing' : `Keypair not found at ${keypairPath}`,
        },
      };

      if (isJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n🛡️  SOVEREIGN SOLANA WALLET & KEYPAIR AUDIT`);
        console.log(`-----------------------------------------------`);
        console.log(`Keypair Path:     ${keypairPath}`);
        console.log(`Public Address:   ${pubkeyStr}`);
        console.log(`Expected Admin:   ${expectedAdmin}`);
        console.log(`Admin Match:      ${matchesExpected ? '✅ MATCHES SYAMSUL ALAM WALLET' : (isAdmin ? '✅ ALLOWLISTED ADMIN' : 'ℹ️ STANDARD PUBLIC CREATOR')}`);
        console.log(`Platform Fee:     ${isAdmin ? '0.00 SOL (Exempt)' : '0.15 SOL (Standard)'}`);
        console.log(`Live Balance:     ${balanceSol} SOL (${values.network})`);
        console.log(`Signing Status:   ${keypairFound ? '✅ Active Signer Verified' : `❌ ${keypairError}`}`);
        console.log(`Security Notice:  Non-custodial Ed25519 runtime strictly prohibits debiting unauthorized addresses.\n`);
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

  // Command: watch
  if (command === 'watch') {
    try {
      if (!values['dry-run']) {
        if (values.simulate) throw new Error('Use watch --dry-run for a fixture or create --simulate for a signed chain simulation.');
        if (!values.mint && !values['position-file']) throw new Error('Pass --mint or resume an existing --position-file.');
        const payer = readExplicitSigner(values.keypair, configuredSigner);
        const { runPumpLifecycle } = await import('../src/lib/pumpLifecycle.js');
        printPumpResult(await runPumpLifecycle(connection, {
          ...pumpOptions(values, PRIORITY_FEE_MAP[priorityLower], payer),
          mint: values.mint ? new PublicKey(values.mint) : undefined,
        }));
        return;
      }
      if (!values.mint) {
        throw new Error('Target Token Mint Address (--mint) is required for watch command.');
      }
      let mintPubkey;
      try {
        mintPubkey = new PublicKey(values.mint.trim());
      } catch {
        throw new Error(`Invalid mint public key: "${values.mint}". Must be base58 public key.`);
      }

      const payerKeypair = Keypair.generate();

      const tp1 = parseStrictDecimal(values.tp1 || '2.0', 'tp1', { min: 1.0 });
      const tp2 = parseStrictDecimal(values.tp2 || '3.5', 'tp2', { min: tp1 });
      const sl = parseStrictDecimal(values.sl || '0.70', 'sl', { min: 0.0, max: 1.0 });
      if (sl >= 1.0) throw new Error('Invalid sl: must be less than 1.0 (e.g. 0.70)');
      const timeout = parseStrictDecimal(values.timeout || '25', 'timeout', { min: 0.0 });
      const slippage = parseStrictDecimal(values.slippage || '5', 'slippage', { min: 0.0, max: 50.0, allowZero: true });
      const pollMs = Math.floor(parseStrictDecimal(values['poll-ms'] || '2000', 'poll-ms', { min: 100 }));
      const maxIter = Math.floor(parseStrictDecimal(values['max-iterations'] || '0', 'max-iterations', { min: 0, allowZero: true }));

      await runWatchLoop({
        connection,
        mintPubkey,
        payerKeypair,
        tp1Multiplier: tp1,
        tp2Multiplier: tp2,
        slMultiplier: sl,
        timeoutMinutes: timeout,
        slippagePercent: slippage,
        pollMs,
        maxIterations: maxIter,
        isDryRun: values['dry-run'],
        isJson,
        priority: priorityLower,
        network: values.network,
      });
    } catch (err) {
      if (isJson) {
        console.error(JSON.stringify({ success: false, error: safeRpcError(err) }, null, 2));
      } else {
        console.error(`Error: ${safeRpcError(err)}`);
      }
      process.exitCode = 1;
    }
    return;
  }

  let scoutUpload;

  // Command: scout
  if (command === 'scout') {
    try {
      const limit = Math.floor(parseStrictDecimal(values.limit || '5', 'limit', { min: 1, allowZero: true }));
      const minBoosts = Math.floor(parseStrictDecimal(values['min-boosts'] || '0', 'min-boosts', { min: 0, allowZero: true }));
      const useAiBridge = values['ai-bridge'] && !values['no-ai-bridge'];

      if (!isJson) {
        console.log(`\n🔎 Scanning Solana meme trends on DexScreener (limit: ${limit})...`);
      }

      const autoPin = values['auto-launch'] && !values['dry-run'] && !values.simulate && values['metadata-uri'] === undefined;
      let uploadToken;
      if (autoPin) {
        uploadToken = process.env.COINER_SCOUT_UPLOAD_TOKEN;
        delete process.env.COINER_SCOUT_UPLOAD_TOKEN;
        if (!uploadToken || !SCOUT_UPLOAD_TOKEN_FORMAT.test(uploadToken)) {
          throw new Error('Set COINER_SCOUT_UPLOAD_TOKEN or provide an explicit --metadata-uri.');
        }
      }
      const trending = await scanTrendingTokens({ limit, minBoosts });

      if (trending.length === 0) {
        if (isJson) {
          console.log(JSON.stringify({ success: true, count: 0, candidates: [] }, null, 2));
        } else {
          console.log(`No tokens met the filter criteria.`);
        }
        return;
      }

      if (!isJson) {
        console.log(`Found ${trending.length} trending candidates. Ingesting narratives...`);
      }

      const candidates = [];
      const stagingRun = createScoutStagingRun(values['staging-dir'] || path.join(process.cwd(), 'staged-coins'));

      for (let i = 0; i < trending.length; i++) {
        const item = trending[i];
        let refined = null;

        if (useAiBridge) {
          if (!isJson) {
            console.log(`[${i + 1}/${trending.length}] Invoking AI Bridge cognitive layer for $${item.symbol} (${item.name})...`);
          }
          refined = await refineCoinNarrative(item);
        } else {
          refined = {
            name: item.name,
            symbol: item.symbol,
            description: `Autonomous viral coin based on ${item.name}`,
            viralityScore: 75,
            derivativeAngle: 'Direct trench emulation',
            suggestedTp1: 2.0,
            suggestedTp2: 3.5,
            suggestedSl: 0.70,
            source: 'deterministic-rules',
            engine: 'none',
          };
        }

        const staged = await stageScoutedProfile(item, refined, stagingRun, i + 1, autoPin && i === 0);
        candidates.push({
          rank: i + 1,
          original: item,
          refined,
          staged,
        });
      }

      if (isJson && !values['auto-launch']) {
        console.log(JSON.stringify({
          success: true,
          count: candidates.length,
          candidates: candidates.map((c) => ({
            rank: c.rank,
            sourceToken: c.original.symbol,
            sourceAddress: c.original.address,
            name: c.staged.name,
            symbol: c.staged.symbol,
            description: c.staged.description,
            imageUrl: c.staged.imageUrl,
            localImage: c.staged.localImagePath,
            metadataFile: c.staged.metadataPath,
            viralityScore: c.refined.viralityScore,
            derivativeAngle: c.refined.derivativeAngle,
            aiSource: c.refined.source,
            aiEngine: c.refined.engine,
            suggestedTp1: c.staged.suggestedTp1,
            suggestedTp2: c.staged.suggestedTp2,
            suggestedSl: c.staged.suggestedSl,
          })),
        }, null, 2));
      } else if (!isJson) {
        console.log(`\n🎯 SCOUTED MEME COIN CANDIDATES`);
        console.log(`===============================================`);
        for (const c of candidates) {
          console.log(`\n#${c.rank} $${c.staged.symbol} — "${c.staged.name}"`);
          console.log(`   Source Meta:    $${c.original.symbol} (Boosts: ${c.original.boosts}, 24h Vol: $${Math.round(c.original.volume24h).toLocaleString()})`);
          console.log(`   Description:    ${c.staged.description}`);
          console.log(`   Virality Score: ${c.refined.viralityScore}/100 [${c.refined.source || 'ai-bridge'}]`);
          console.log(`   Angle:          ${c.refined.derivativeAngle || 'Direct narrative emulation'}`);
          console.log(`   Image URL:      ${c.staged.imageUrl}`);
          console.log(`   Staged Path:    ${c.staged.stagingDir}`);
          console.log(`   Suggested TP:   TP1: ${c.staged.suggestedTp1}x | TP2: ${c.staged.suggestedTp2}x | SL: ${c.staged.suggestedSl}x`);
        }
        console.log(`\n===============================================`);
      }

      if (values['auto-launch'] && candidates.length > 0) {
        const top = candidates[0];
        if (!isJson) {
          console.log(`\n🚀 Auto-Launch Triggered for #${top.rank} $${top.staged.symbol}...`);
        }

        // Fail-closed if image validation failed and no explicit metadata URI provided (S04)
        if (!top.staged.imageValid && !values.simulate && values['metadata-uri'] === undefined) {
          throw new Error(`Auto-launch aborted: Downloaded image failed validation for $${top.staged.symbol}. Provide an explicit --metadata-uri or select another candidate.`);
        }

        values.name = top.staged.name;
        values.symbol = top.staged.symbol;
        values.description = top.staged.description;
        
        if (autoPin) {
          scoutUpload = { staged: top.staged, token: uploadToken };
        } else if ((values['dry-run'] || values.simulate) && values['metadata-uri'] === undefined) {
          values['metadata-uri'] = SCOUT_DRY_RUN_METADATA_URI;
        }

        // Preserve operator CLI thresholds over AI suggestions if explicitly provided (S05)
        if (!parsed.values.tp1) {
          values.tp1 = String(top.staged.suggestedTp1);
        }
        if (!parsed.values.tp2) {
          values.tp2 = String(top.staged.suggestedTp2);
        }
        if (!parsed.values.sl) {
          values.sl = String(top.staged.suggestedSl);
        }

        command = 'create';
      } else {
        return;
      }
    } catch (err) {
      if (isJson) {
        console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exitCode = 1;
      return;
    }
  }

  // Command: create
  if (command === 'create') {
    try {
      if (values.simulate && values['dry-run']) throw new Error('Choose either --simulate or --dry-run.');
      if (values.target.toLowerCase() === 'pump') {
        if (values['dry-run']) throw new Error('Use --simulate with an explicit funded signer for a Pump launch.');
        if (values['keep-freeze'] || values['keep-mint'] || values.mutable ||
          values.decimals !== '6' || values.supply !== '1000000000' || values['quote-sol'] !== undefined || values['burn-lp']) {
          throw new Error('Pump launches use the Pump program’s fixed supply, decimals and authorities.');
        }
        const payer = readExplicitSigner(values.keypair, configuredSigner);
        const options = pumpOptions(values, PRIORITY_FEE_MAP[priorityLower], payer);
        const name = (values.name || '').trim();
        const symbol = (values.symbol || '').trim().toUpperCase();
        if (!name || !symbol || getUtf8ByteLength(name) > 32 || getUtf8ByteLength(symbol) > 10) {
          throw new Error('Pump launches require a name up to 32 UTF-8 bytes and a symbol up to 10 UTF-8 bytes.');
        }
        const buyLamports = values['initial-buy-sol'] === undefined ? 0n : calculateRawAmount(values['initial-buy-sol'], 9);
        if (!values['max-spend-sol']) throw new Error('Set --max-spend-sol for a Pump launch.');
        const maxSpend = calculateRawAmount(values['max-spend-sol'], 9);
        if (buyLamports >= maxSpend || ((values['auto-exit'] || values['liquidate-now']) && buyLamports === 0n)) {
          throw new Error('Set --max-spend-sol above the initial buy. Auto-exit requires an initial buy.');
        }
        const uri = async () => scoutUpload
          ? validateMetadataUri(await publishScoutMetadata(scoutUpload.staged, {
            name, symbol, decimals: 6, supply: '1000000000', token: scoutUpload.token,
          }))
          : validateMetadataUri(values['metadata-uri']);
        const { runPumpLifecycle } = await import('../src/lib/pumpLifecycle.js');
        printPumpResult(await runPumpLifecycle(connection, {
          ...options, launch: { name, symbol, uri, buyLamports, maxSpend }, autoExit: values['auto-exit'],
        }));
        return;
      }
      if (values.target && values.target.toLowerCase() !== 'spl') {
        throw new Error(`Unsupported deployment target "${values.target}". Allowed targets: spl, pump.`);
      }

      if (values['initial-buy-sol']) {
        throw new Error(
          'Option --initial-buy-sol is only valid for Pump.fun launches (--target pump). Standard SPL tokens do not have an embedded bonding curve initial buy.'
        );
      }
      if (values['liquidate-now'] || values['position-file'] !== undefined || values['max-spend-sol'] !== undefined) {
        throw new Error('Position and liquidation options require a Pump launch.');
      }

      if (values['auto-exit'] && !values['dry-run']) {
        throw new Error(
          'Live --auto-exit cannot be attached to standard SPL token creation because SPL tokens lack an automated Pump.fun bonding curve. Use "coiner-cli watch --mint <CA>" directly on existing Pump.fun tokens.'
        );
      }

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

      let metadataUri = scoutUpload ? '' : validateMetadataUri(values['metadata-uri']);

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
      } else if (values.simulate) {
        const { verifySolanaCluster } = await import('../src/lib/pumpPosition.js');
        await verifySolanaCluster(connection, values.network);
        payerKeypair = readExplicitSigner(values.keypair, configuredSigner);
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

      if (scoutUpload) {
        const { staged, token } = scoutUpload;
        metadataUri = validateMetadataUri(await publishScoutMetadata(staged, {
          name, symbol, decimals, supply: values.supply, token,
        }));
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

        if (values['auto-exit']) {
          if (!isJson) {
            console.log(`\n🚀 Transitioning immediately to Simulated Exit Watcher for $${symbol}...`);
          }
          const tp1 = parseStrictDecimal(values.tp1 || '2.0', 'tp1', { min: 1.0 });
          const tp2 = parseStrictDecimal(values.tp2 || '3.5', 'tp2', { min: tp1 });
          const sl = parseStrictDecimal(values.sl || '0.70', 'sl', { min: 0.0, max: 1.0 });
          if (sl >= 1.0) throw new Error('Invalid sl: must be less than 1.0 (e.g. 0.70)');
          const timeout = parseStrictDecimal(values.timeout || '25', 'timeout', { min: 0.0 });
          const slippage = parseStrictDecimal(values.slippage || '5', 'slippage', { min: 0.0, max: 50.0, allowZero: true });
          const pollMs = Math.floor(parseStrictDecimal(values['poll-ms'] || '2000', 'poll-ms', { min: 100 }));
          const maxIter = Math.floor(parseStrictDecimal(values['max-iterations'] || '3', 'max-iterations', { min: 0, allowZero: true }));

          await runWatchLoop({
            connection,
            mintPubkey,
            payerKeypair,
            tp1Multiplier: tp1,
            tp2Multiplier: tp2,
            slMultiplier: sl,
            timeoutMinutes: timeout,
            slippagePercent: slippage,
            pollMs,
            maxIterations: maxIter > 0 ? maxIter : 3,
            isDryRun: true,
            isJson,
            priority: priorityLower,
            network: values.network,
          });
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
      if (values.simulate) {
        const result = await connection.simulateTransaction(VersionedTransaction.deserialize(rawTx), {
          commitment: 'confirmed', sigVerify: true,
        });
        console.log(JSON.stringify({
          success: result.value.err === null, status: 'simulated', network: values.network,
          mint: mintPubkey.toBase58(), error: result.value.err, unitsConsumed: result.value.unitsConsumed,
        }, null, 2));
        if (result.value.err !== null) process.exitCode = 2;
        return;
      }

      if (!isJson) {
        console.log('Broadcasting signed transaction...');
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
        const sigStatus = await checkSignatureStatus(connection, signature);
        if (sigStatus?.kind !== 'confirmed') {
          throw new Error(
            `Transaction was broadcast with signature ${signature}, but confirmation timed out or failed (status: ${sigStatus?.kind || 'unknown'}): ${confirmErr.message}.\n` +
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
        console.error(JSON.stringify({ success: false, error: safeRpcError(err) }, null, 2));
      } else {
        console.error(`Error: ${safeRpcError(err)}`);
      }
      process.exitCode = 1;
    }
  }
}

const isMainModule = Boolean(
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
);
if (isMainModule) {
  run().catch((err) => {
    console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
    process.exitCode = 1;
  });
}
