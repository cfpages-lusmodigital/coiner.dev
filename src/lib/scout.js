/**
 * scout.js — Autonomous Market Trend Scanner & Asset Harvester for coiner.dev
 * 
 * Scans Solana meme trends from DexScreener APIs (Profiles & Boosts),
 * ingests trending graphics, tickers, descriptions, and source social links,
 * downloads and validates image buffers, and formats Metaplex-compliant metadata.
 * 
 * Hardened per Engineer Sol Audit COINER-SCOUT-AI-1 (S01, S02, S03, S04, S08, S09, S10, S12).
 */

import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import http from 'node:http';
import https from 'node:https';
import { Resolver } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

export const DEXSCREENER_PROFILES_API = 'https://api.dexscreener.com/token-profiles/latest/v1';
export const DEXSCREENER_BOOSTS_API = 'https://api.dexscreener.com/token-boosts/top/v1';
export const DEXSCREENER_TOKENS_API = 'https://api.dexscreener.com/latest/dex/tokens/';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB hard limit
export const MAX_API_BYTES = 1 * 1024 * 1024; // 1 MB hard limit for API responses

const restrictedIpv4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) {
  restrictedIpv4.addSubnet(address, prefix);
}

const globalIpv6 = new BlockList();
globalIpv6.addSubnet('2000::', 3, 'ipv6');
const restrictedIpv6 = new BlockList();
for (const [address, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
]) {
  restrictedIpv6.addSubnet(address, prefix, 'ipv6');
}

function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !restrictedIpv4.check(address);
  return family === 6 && globalIpv6.check(address, 'ipv6') && !restrictedIpv6.check(address, 'ipv6');
}

async function resolvePublicAddress(hostname, signal) {
  signal.throwIfAborted();
  if (isIP(hostname)) {
    if (isPublicAddress(hostname)) return hostname;
    throw new Error('Scout destination is not a public IP address.');
  }

  const resolver = new Resolver();
  const cancel = () => resolver.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const results = await Promise.allSettled([resolver.resolve4(hostname), resolver.resolve6(hostname)]);
    signal.throwIfAborted();
    const addresses = [];
    for (const result of results) {
      if (result.status === 'fulfilled') addresses.push(...result.value);
      else if (!['ENODATA', 'ENOTFOUND'].includes(result.reason.code)) throw new Error('Scout DNS resolution failed.');
    }
    if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
      throw new Error('Scout DNS resolution did not return exclusively public addresses.');
    }
    return addresses[0];
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

async function fetchPublicBytes(urlString, maxBytes, signal) {
  const url = new URL(urlString);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
      /(^|\.)(localhost|local)\.?$/.test(hostname)) {
    throw new Error('Scout requires a public HTTP(S) URL without credentials or a custom port.');
  }
  const address = await resolvePublicAddress(hostname, signal);
  const transport = url.protocol === 'https:' ? https : http;
  const response = await new Promise((resolve, reject) => {
    const request = transport.request(url, {
      agent: false,
      autoSelectFamily: false,
      lookup: (_hostname, _options, callback) => callback(null, address, isIP(address)),
      signal,
      headers: { 'User-Agent': 'coiner-scout/1.0', 'Accept-Encoding': 'identity' },
    }, resolve);
    request.on('error', reject);
    request.end();
  });

  try {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Scout request failed: HTTP ${response.statusCode}`);
    }
    if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
      throw new Error('Scout received an unsupported content encoding.');
    }
    if (Number(response.headers['content-length']) > maxBytes) {
      throw new Error(`Scout response exceeded ${maxBytes} bytes.`);
    }
    const chunks = [];
    let receivedBytes = 0;
    for await (const chunk of response) {
      signal.throwIfAborted();
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) throw new Error(`Scout response exceeded ${maxBytes} bytes.`);
      chunks.push(chunk);
    }
    signal.throwIfAborted();
    return Buffer.concat(chunks, receivedBytes);
  } finally {
    response.destroy();
  }
}

async function fetchMarketJson(url, signal) {
  return JSON.parse((await fetchPublicBytes(url, MAX_API_BYTES, signal)).toString('utf8'));
}

/**
 * Validates image buffer magic bytes with full signature checks (S12)
 */
export function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 12) {
    return { valid: false, error: 'Buffer too small to determine image format' };
  }

  // Full 8-byte PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return { valid: true, mimeType: 'image/png', ext: 'png' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg', ext: 'jpg' };
  }

  // WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, mimeType: 'image/webp', ext: 'webp' };
  }

  // Full GIF header: GIF87a or GIF89a (47 49 46 38 37/39 61)
  if (
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
  ) {
    return { valid: true, mimeType: 'image/gif', ext: 'gif' };
  }

  return { valid: false, error: 'Unsupported image format (must be full PNG, JPEG, WebP, or GIF)' };
}

/**
 * Downloads and validates an image from URL with streamed byte limiting and full-body deadline (S02, S03)
 */
export async function downloadAndValidateImage(imageUrl, timeoutMs = 12000) {
  const buffer = await fetchPublicBytes(imageUrl, MAX_IMAGE_BYTES, AbortSignal.timeout(timeoutMs));
  const format = detectImageFormat(buffer);
  if (!format.valid) throw new Error(format.error);
  return { buffer, mimeType: format.mimeType, ext: format.ext, sizeBytes: buffer.length };
}

/**
 * Fetches token pair information for given addresses from DexScreener with streaming limits (S02)
 */
export async function fetchDexScreenerPairs(tokenAddresses, timeoutMs = 10000, signal = AbortSignal.timeout(timeoutMs)) {
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) return { ok: true, pairs: [] };
  const validAddresses = tokenAddresses.filter((a) => typeof a === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a));
  if (validAddresses.length === 0) return { ok: true, pairs: [] };

  const chunk = validAddresses.slice(0, 30).join(',');
  const url = `${DEXSCREENER_TOKENS_API}${chunk}`;

  try {
    const data = await fetchMarketJson(url, signal);
    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
    return { ok: true, pairs };
  } catch (err) {
    return { ok: false, error: err.message, pairs: [] };
  }
}

/**
 * Scans trending tokens from DexScreener Profiles and Boosts.
 * Hardened to validate row shapes, prevent string concatenation sorting, filter before limit,
 * and verify membership in requested address universe (S08, S10).
 */
export async function scanTrendingTokens(options = {}) {
  if (options.source && options.source !== 'dexscreener') {
    throw new Error(`Unsupported market data source: "${options.source}". Supported sources: "dexscreener"`);
  }

  const limit = options.limit || 5;
  const minBoosts = options.minBoosts != null ? Number(options.minBoosts) : 0;
  const timeoutMs = options.timeoutMs || 12000;
  const signal = AbortSignal.timeout(timeoutMs);

  const [profilesRes, boostsRes] = await Promise.allSettled([
    fetchMarketJson(DEXSCREENER_PROFILES_API, signal),
    fetchMarketJson(DEXSCREENER_BOOSTS_API, signal)
  ]);

  const rawProfiles = Array.isArray(profilesRes.value) ? profilesRes.value : [];
  const rawBoosts = Array.isArray(boostsRes.value) ? boostsRes.value : [];

  if (profilesRes.status === 'rejected' && boostsRes.status === 'rejected') {
    throw new Error(`Upstream market data unavailable: Profiles (${profilesRes.reason?.message}); Boosts (${boostsRes.reason?.message})`);
  }

  // Filter for Solana tokens and collect addresses with strict null guards (S08)
  const addressSet = new Set();
  const addressBoostMap = new Map();

  for (const b of rawBoosts) {
    if (b && typeof b === 'object' && b.chainId === 'solana' && typeof b.tokenAddress === 'string') {
      const addr = b.tokenAddress.trim();
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
        addressSet.add(addr);
        const boostVal = Number(b.totalAmount);
        addressBoostMap.set(addr, Number.isFinite(boostVal) && boostVal > 0 ? boostVal : 0);
      }
    }
  }

  for (const p of rawProfiles) {
    if (p && typeof p === 'object' && p.chainId === 'solana' && typeof p.tokenAddress === 'string') {
      const addr = p.tokenAddress.trim();
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
        addressSet.add(addr);
      }
    }
  }

  const addresses = Array.from(addressSet);
  if (addresses.length === 0) {
    return [];
  }

  // Fetch detailed pair metadata for queried batch of up to 30 addresses (S08)
  const batch = addresses.slice(0, 30);
  const batchSet = new Set(batch);
  const pairsResult = await fetchDexScreenerPairs(batch, timeoutMs, signal);
  if (!pairsResult.ok && pairsResult.pairs.length === 0) {
    throw new Error(`Failed to fetch token pair metadata: ${pairsResult.error}`);
  }

  const candidateMap = new Map();

  for (const pair of pairsResult.pairs) {
    // Assert row shape and verify membership strictly in queried batch (S08)
    if (!pair || typeof pair !== 'object') continue;
    if (pair.chainId !== 'solana' || !pair.baseToken?.address) continue;
    const addr = pair.baseToken.address;
    if (!batchSet.has(addr)) continue;

    // Strict numeric conversion to prevent string concatenation comparison (S10, P23)
    const rawVol = Number(pair.volume?.h24);
    const volume24h = Number.isFinite(rawVol) && rawVol > 0 ? rawVol : 0;
    const existing = candidateMap.get(addr);

    if (!existing || volume24h > existing.volume24h) {
      let twitter = '';
      let telegram = '';
      let website = '';

      if (Array.isArray(pair.info?.socials)) {
        for (const s of pair.info.socials) {
          if (s && typeof s === 'object' && typeof s.url === 'string') {
            if (s.type === 'twitter' && !twitter) twitter = s.url.trim();
            if (s.type === 'telegram' && !telegram) telegram = s.url.trim();
          }
        }
      }

      if (Array.isArray(pair.info?.websites) && pair.info.websites[0]?.url) {
        website = String(pair.info.websites[0].url).trim();
      }

      const imageUrl = typeof pair.info?.imageUrl === 'string' ? pair.info.imageUrl.trim() : '';
      const headerUrl = typeof pair.info?.header === 'string' ? pair.info.header.trim() : '';

      candidateMap.set(addr, {
        address: addr,
        name: typeof pair.baseToken.name === 'string' ? pair.baseToken.name.trim() : '',
        symbol: typeof pair.baseToken.symbol === 'string' ? pair.baseToken.symbol.trim().replace(/^\$/, '') : '',
        priceUsd: typeof pair.priceUsd === 'string' ? pair.priceUsd : String(pair.priceUsd || '0'),
        volume24h,
        fdv: Number(pair.fdv) || 0,
        imageUrl,
        headerUrl,
        twitterUrl: twitter,
        telegramUrl: telegram,
        websiteUrl: website,
        boosts: addressBoostMap.get(addr) || 0,
      });
    }
  }

  // Filter candidates by valid attributes and minBoosts BEFORE limiting by limit (S10, P24)
  const results = Array.from(candidateMap.values())
    .filter((c) => Boolean(c.name && c.symbol && c.imageUrl))
    .filter((c) => c.boosts >= minBoosts)
    .sort((a, b) => {
      // Deterministic numeric score calculation (S10)
      const scoreA = a.boosts * 1000 + a.volume24h;
      const scoreB = b.boosts * 1000 + b.volume24h;
      return scoreB - scoreA;
    })
    .slice(0, limit);

  return results;
}

function verifyStagingDirectory(directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      path.relative(directory, fs.realpathSync.native(directory)) !== '') {
    throw new Error('Scout staging requires an ordinary directory without linked components.');
  }
}

export function createScoutStagingRun(baseStagingDir) {
  const base = path.resolve(baseStagingDir);
  const root = path.parse(base).root;
  let current = root;
  verifyStagingDirectory(current);
  for (const component of path.relative(root, base).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    try {
      fs.mkdirSync(current, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    verifyStagingDirectory(current);
  }
  const run = fs.mkdtempSync(path.join(base, 'run-'));
  verifyStagingDirectory(run);
  return run;
}

export async function stageScoutedProfile(candidate, refinedAiData, stagingRun, index = 1, keepImage = false) {
  if (!Number.isSafeInteger(index) || index < 1) throw new Error('Invalid scout candidate index.');
  const base = path.resolve(stagingRun);
  const rawSymbol = String(candidate.symbol || 'coin').toLowerCase();
  const safeSymbol = rawSymbol.replace(/[^a-z0-9_-]/g, '_').slice(0, 16) || 'coin';
  const stagingDir = path.resolve(base, `${index}_${safeSymbol}`);
  if (path.dirname(stagingDir) !== base) throw new Error('Scout candidate path is outside the staging run.');

  let image = null;
  if (candidate.imageUrl) {
    try {
      image = await downloadAndValidateImage(candidate.imageUrl);
    } catch {
      // A candidate can still be inspected locally. Automatic publishing requires a validated image.
    }
  }
  verifyStagingDirectory(base);
  fs.mkdirSync(stagingDir, { mode: 0o700 });
  verifyStagingDirectory(stagingDir);

  const imageFilename = image ? `icon.${image.ext}` : '';
  const localImagePath = image ? path.join(stagingDir, imageFilename) : '';
  if (image) fs.writeFileSync(localImagePath, image.buffer, { flag: 'wx', mode: 0o600 });

  const name = refinedAiData?.name || candidate.name;
  const symbol = refinedAiData?.symbol || candidate.symbol;
  const description = refinedAiData?.description || `Autonomous viral meme coin on Solana.`;

  // 2. Metaplex standard metadata JSON
  const metadata = {
    name,
    symbol,
    description,
    image: imageFilename,
    attributes: [
      { trait_type: 'Source Meta', value: candidate.name },
      { trait_type: 'Virality Score', value: String(refinedAiData?.viralityScore || 75) },
      { trait_type: 'Derivative Angle', value: refinedAiData?.derivativeAngle || 'Trench Momentum' },
    ],
    properties: {
      files: image ? [{ uri: imageFilename, type: image.mimeType }] : [],
      category: 'image',
    },
    extensions: {
      website: candidate.websiteUrl || 'https://coiner.dev',
      twitter: candidate.twitterUrl || 'https://x.com/coiner_dev',
      telegram: candidate.telegramUrl || 'https://t.me/coiner_portal',
    },
  };

  const metadataPath = path.join(stagingDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), { encoding: 'utf8', flag: 'wx', mode: 0o600 });

  return {
    stagingDir,
    localImagePath,
    metadataPath,
    metadata,
    image: keepImage ? image : null,
    name,
    symbol,
    description,
    imageUrl: candidate.imageUrl,
    imageValid: Boolean(image),
    twitterUrl: candidate.twitterUrl,
    telegramUrl: candidate.telegramUrl,
    websiteUrl: candidate.websiteUrl,
    suggestedTp1: refinedAiData?.suggestedTp1 || 2.0,
    suggestedTp2: refinedAiData?.suggestedTp2 || 3.5,
    suggestedSl: refinedAiData?.suggestedSl || 0.70,
  };
}
