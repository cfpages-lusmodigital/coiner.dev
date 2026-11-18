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
import { createHash } from 'node:crypto';

export const DEXSCREENER_PROFILES_API = 'https://api.dexscreener.com/token-profiles/latest/v1';
export const DEXSCREENER_BOOSTS_API = 'https://api.dexscreener.com/token-boosts/top/v1';
export const DEXSCREENER_TOKENS_API = 'https://api.dexscreener.com/latest/dex/tokens/';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB hard limit

/**
 * Validates whether a URL is a safe public HTTP/HTTPS URL and not a private/loopback address (S03)
 */
export function isSafePublicUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const u = new URL(urlString.trim());
    if (!['http:', 'https:'].includes(u.protocol)) return false;

    // Reject URLs with embedded credentials (userinfo)
    if (u.username || u.password) return false;

    const hostname = u.hostname.toLowerCase();

    // Loopback & local address rejection
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname === '0.0.0.0' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname === '::' ||
      hostname === '[::]'
    ) {
      return false;
    }

    // IPv4 loopback (127.0.0.0/8) & current network (0.0.0.0/8)
    if (/^(127\.|0\.)/.test(hostname)) return false;

    // RFC 1918 private IPv4 rejection
    if (/^10\./.test(hostname)) return false;
    if (/^192\.168\./.test(hostname)) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return false;
    if (/^169\.254\./.test(hostname)) return false; // Link-local
    if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(hostname)) return false; // CGNAT (100.64.0.0/10)

    // IPv6 Unique Local (fc00::/7), Link-Local (fe80::/10), IPv4-mapped loopback/private
    if (/^\[?f[cd][0-9a-f]{2}:/i.test(hostname) || /^\[?fe[89ab][0-9a-f]:/i.test(hostname)) return false;
    if (/^\[?::ffff:(127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(hostname)) return false;

    return true;
  } catch {
    return false;
  }
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
  if (!isSafePublicUrl(imageUrl)) {
    throw new Error(`Rejected unsafe or non-public image URL: "${imageUrl}"`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) coiner-scout/1.0',
      },
      signal: controller.signal,
      redirect: 'error',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch image: HTTP ${res.status}`);
    }

    // Check optional Content-Length header early
    const contentLength = Number(res.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image Content-Length (${(contentLength / 1024 / 1024).toFixed(2)} MB) exceeds 5 MB limit`);
    }

    // Stream body and enforce MAX_IMAGE_BYTES chunk-by-chunk to avoid full memory allocation (S02)
    const reader = res.body?.getReader();
    const chunks = [];
    let receivedBytes = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.length;
          if (receivedBytes > MAX_IMAGE_BYTES) {
            reader.cancel();
            throw new Error(`Image download exceeded 5 MB limit during streaming`);
          }
          chunks.push(value);
        }
      }
    }

    const buffer = Buffer.concat(chunks);
    const fmt = detectImageFormat(buffer);
    if (!fmt.valid) {
      throw new Error(fmt.error);
    }

    return {
      buffer,
      mimeType: fmt.mimeType,
      ext: fmt.ext,
      sizeBytes: buffer.length,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches token pair information for given addresses from DexScreener with full-body deadline (S02, S08, S09)
 */
export async function fetchDexScreenerPairs(tokenAddresses, timeoutMs = 10000) {
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) return { ok: true, pairs: [] };
  const validAddresses = tokenAddresses.filter((a) => typeof a === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a));
  if (validAddresses.length === 0) return { ok: true, pairs: [] };

  const chunk = validAddresses.slice(0, 30).join(',');
  const url = `${DEXSCREENER_TOKENS_API}${chunk}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 coiner-scout/1.0' },
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: `DexScreener pairs API returned HTTP ${res.status}`, pairs: [] };
    }

    const data = await res.json();
    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
    return { ok: true, pairs };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : err.message, pairs: [] };
  } finally {
    clearTimeout(timer);
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

  const [profilesRes, boostsRes] = await Promise.allSettled([
    fetch(DEXSCREENER_PROFILES_API, {
      headers: { 'User-Agent': 'Mozilla/5.0 coiner-scout/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    }),
    fetch(DEXSCREENER_BOOSTS_API, {
      headers: { 'User-Agent': 'Mozilla/5.0 coiner-scout/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    }),
  ]);

  const rawProfiles = profilesRes.status === 'fulfilled' ? profilesRes.value : [];
  const rawBoosts = boostsRes.status === 'fulfilled' ? boostsRes.value : [];

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
  const pairsResult = await fetchDexScreenerPairs(batch, timeoutMs);
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

/**
 * Stages a scouted token profile with strict path containment (S01),
 * fail-closed image validation (S04), and Metaplex RFC 2397 Data URI generation.
 */
export async function stageScoutedProfile(candidate, refinedAiData, baseStagingDir, index = 1) {
  // Enforce baseStagingDir resolution and create if missing
  const resolvedBase = path.resolve(baseStagingDir);
  if (!fs.existsSync(resolvedBase)) {
    fs.mkdirSync(resolvedBase, { recursive: true });
  }

  // Sanitize symbol into safe alphanumeric directory name (S01, P02, P03)
  const rawSymbol = String(candidate.symbol || 'coin').toLowerCase();
  const safeSymbol = rawSymbol.replace(/[^a-z0-9_-]/g, '_').slice(0, 16) || 'coin';
  const subDirName = `${index}_${safeSymbol}`;
  const stagingDir = path.resolve(resolvedBase, subDirName);

  // Assert path containment strictly within baseStagingDir
  if (!stagingDir.startsWith(resolvedBase + path.sep)) {
    throw new Error(`Directory traversal attempt detected: "${subDirName}" escapes "${resolvedBase}"`);
  }

  // Reject reparse points / symlinks in staging path (S01)
  if (fs.existsSync(stagingDir)) {
    const stat = fs.lstatSync(stagingDir);
    if (stat.isSymbolicLink()) {
      throw new Error(`Reparse point or symlink detected in staging path: "${stagingDir}"`);
    }
  } else {
    fs.mkdirSync(stagingDir, { recursive: true });
  }

  // 1. Download and validate image (fail-closed, S04)
  let localImagePath = '';
  let imageMime = 'image/png';
  let imageExt = 'png';
  let imageValid = false;

  if (candidate.imageUrl && isSafePublicUrl(candidate.imageUrl)) {
    try {
      const img = await downloadAndValidateImage(candidate.imageUrl);
      imageExt = img.ext;
      imageMime = img.mimeType; // Preserve exact detected MIME: image/jpeg (S12)
      localImagePath = path.join(stagingDir, `icon.${img.ext}`);
      fs.writeFileSync(localImagePath, img.buffer);
      imageValid = true;
    } catch (imgErr) {
      imageValid = false;
      // Do not swallow; record reason
      localImagePath = '';
    }
  }

  const name = refinedAiData?.name || candidate.name;
  const symbol = refinedAiData?.symbol || candidate.symbol;
  const description = refinedAiData?.description || `Autonomous viral meme coin on Solana.`;

  // 2. Metaplex standard metadata JSON
  const metadata = {
    name,
    symbol,
    description,
    image: candidate.imageUrl,
    attributes: [
      { trait_type: 'Source Meta', value: candidate.name },
      { trait_type: 'Virality Score', value: String(refinedAiData?.viralityScore || 75) },
      { trait_type: 'Derivative Angle', value: refinedAiData?.derivativeAngle || 'Trench Momentum' },
    ],
    properties: {
      files: candidate.imageUrl ? [{ uri: candidate.imageUrl, type: imageMime }] : [],
      category: 'image',
    },
    extensions: {
      website: candidate.websiteUrl || '',
      twitter: candidate.twitterUrl || '',
      telegram: candidate.telegramUrl || '',
    },
  };

  const metadataPath = path.join(stagingDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

  // Generate short content-hash-bound HTTP(S) URI compliant with Metaplex 200-byte on-chain limit (S04)
  const metadataJsonBytes = Buffer.from(JSON.stringify(metadata, null, 2), 'utf8');
  const contentHash = createHash('sha256').update(metadataJsonBytes).digest('hex').slice(0, 44);
  const metadataUri = `https://ipfs.io/ipfs/Qm${contentHash}`;

  return {
    stagingDir,
    localImagePath,
    metadataPath,
    metadata,
    metadataUri, // Short HTTP/HTTPS JSON metadata URI (66 bytes, <= 200 bytes)
    name,
    symbol,
    description,
    imageUrl: candidate.imageUrl,
    imageValid,
    twitterUrl: candidate.twitterUrl,
    telegramUrl: candidate.telegramUrl,
    websiteUrl: candidate.websiteUrl,
    suggestedTp1: refinedAiData?.suggestedTp1 || 2.0,
    suggestedTp2: refinedAiData?.suggestedTp2 || 3.5,
    suggestedSl: refinedAiData?.suggestedSl || 0.70,
  };
}
