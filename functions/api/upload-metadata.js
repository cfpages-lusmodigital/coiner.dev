// functions/api/upload-metadata.js
// Stateless IPFS Pinning & Metadata Proxy for coiner.dev
// Zero server wallets, zero private keys, zero server transaction fees.

import { BodyTooLargeError, pinnedFileUri, readBoundedBody, readPinningJson } from '../../src/lib/ipfsMetadata.js';

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/([a-zA-Z0-9-]+\.)*coiner\.dev$/,
  /^https:\/\/([a-zA-Z0-9-]+\.)*pages\.dev$/,
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://coiner.dev',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

const ALLOWED_FIELDS = [
  'name',
  'symbol',
  'description',
  'decimals',
  'supply',
  'image',
  'website',
  'twitter',
  'telegram',
  'discord',
];

const MAX_TOTAL_BODY_SIZE = 5.5 * 1024 * 1024; // 5.5 MB max body size
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;        // 5.0 MB max image size

function jsonResponse(status, body, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Validates and sanitizes a user-provided HTTP/HTTPS link.
 * Rejects javascript:, data:, credentials, control chars, and excess length.
 */
function validateUrl(urlStr, fieldName) {
  if (!urlStr) return '';
  const trimmed = urlStr.trim();
  if (!trimmed) return '';
  if (trimmed.length > 100) {
    throw new Error(`Field "${fieldName}" URL exceeds 100 characters.`);
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Field "${fieldName}" is not a valid URL: "${trimmed}".`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Field "${fieldName}" must use http:// or https:// protocol (got ${parsed.protocol}).`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`Field "${fieldName}" cannot contain user credentials.`);
  }
  return parsed.toString();
}

/**
 * Verifies raster image file signatures (magic bytes) to prevent MIME spoofing.
 * Strictly permits PNG, JPEG, WebP, and GIF.
 * SVGs are explicitly rejected to prevent active script/XML injection in metadata.
 */
async function verifyRasterImage(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('Image file is invalid or missing.');
  }

  if (file.size === 0) {
    throw new Error('Image file cannot be empty.');
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`Image file size (${file.size} bytes) exceeds maximum 5MB limit.`);
  }

  const headerBuffer = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(headerBuffer);

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  // JPEG magic bytes: FF D8 FF
  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  // GIF magic bytes: GIF87a or GIF89a
  const isGif =
    bytes.length >= 6 &&
    bytes[0] === 0x47 && // G
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x38 && // 8
    (bytes[4] === 0x37 || bytes[4] === 0x39) && // 7 or 9
    bytes[5] === 0x61;   // a

  // WebP magic bytes: RIFF....WEBP
  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50; // WEBP

  if (isPng) return 'image/png';
  if (isJpeg) return 'image/jpeg';
  if (isGif) return 'image/gif';
  if (isWebp) return 'image/webp';

  throw new Error(
    'Invalid image file content. File signature does not match a valid PNG, JPEG, WebP, or GIF image (SVGs and non-raster files are not permitted).'
  );
}

export async function onRequestOptions(context) {
  const cors = getCorsHeaders(context.request);
  return new Response(null, { headers: cors });
}

export function onRequestPost(context) {
  return handleUploadMetadata(context);
}

async function pinFile(file, filename, authHeaders) {
  let phase = 'multipart';
  let upstreamStatus = null;
  try {
    const form = new FormData();
    form.append('file', file, filename);
    form.append('pinataOptions', JSON.stringify({ cidVersion: 0 }));
    phase = 'request';
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: authHeaders,
      body: form,
      // Workers supports manual redirects, which the response validator rejects.
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    upstreamStatus = response.status;
    phase = 'response';
    const payload = await readPinningJson(response);
    phase = 'cid';
    return pinnedFileUri(payload?.IpfsHash);
  } catch (error) {
    console.warn('Coiner IPFS pin failed', {
      asset: filename === 'metadata.json' ? 'metadata' : 'image',
      phase,
      upstreamStatus,
      kind: ['TimeoutError', 'AbortError', 'SyntaxError', 'TypeError'].includes(error?.name)
        ? error.name : 'Error',
    });
    throw error;
  }
}

export async function handleUploadMetadata(context, { requireImage = false } = {}) {
  const { request, env } = context;
  const cors = getCorsHeaders(request);

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!/^multipart\/form-data\s*;/i.test(contentType)) {
      return jsonResponse(400, {
        success: false,
        error: 'Expected multipart/form-data request.',
      }, cors);
    }

    let formData;
    try {
      const bytes = await readBoundedBody(request, MAX_TOTAL_BODY_SIZE, AbortSignal.timeout(15000));
      formData = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData();
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        return jsonResponse(413, { success: false, error: 'Multipart request exceeds 5.5 MiB.' }, cors);
      }
      if (error.name === 'TimeoutError') {
        return jsonResponse(408, { success: false, error: 'Multipart upload exceeded its deadline.' }, cors);
      }
      return jsonResponse(400, { success: false, error: 'Invalid multipart request.' }, cors);
    }

    // 4. Strict Field Multiplicity and Key Validation
    const seenFields = new Set();
    for (const [key, val] of formData.entries()) {
      if (!ALLOWED_FIELDS.includes(key)) {
        return jsonResponse(400, {
          success: false,
          error: `Unrecognized form field "${key}". Allowed fields: ${ALLOWED_FIELDS.join(', ')}.`,
        }, cors);
      }
      if (seenFields.has(key)) {
        return jsonResponse(400, {
          success: false,
          error: `Duplicate field "${key}" detected in multipart payload.`,
        }, cors);
      }
      seenFields.add(key);

      if (key !== 'image' && typeof val !== 'string') {
        return jsonResponse(400, {
          success: false,
          error: `Field "${key}" must be a string.`,
        }, cors);
      }
    }

    const name = (formData.get('name') || '').trim();
    const symbol = (formData.get('symbol') || '').trim().toUpperCase();
    const description = (formData.get('description') || '').trim();
    const decStr = (formData.get('decimals') || '6').trim();
    const supply = (formData.get('supply') || '1000000000').trim();
    const imageFile = formData.get('image');

    // 5. Token Name Validation (Metaplex 32 UTF-8 bytes limit)
    if (!name) {
      return jsonResponse(400, { success: false, error: 'Token Name is required.' }, cors);
    }
    const nameBytes = new TextEncoder().encode(name).length;
    if (nameBytes > 32) {
      return jsonResponse(400, {
        success: false,
        error: `Token Name exceeds Metaplex limit of 32 UTF-8 bytes (got ${nameBytes} bytes).`,
      }, cors);
    }

    // 6. Token Symbol Validation (Metaplex 10 UTF-8 bytes limit)
    if (!symbol) {
      return jsonResponse(400, { success: false, error: 'Token Symbol is required.' }, cors);
    }
    const symbolBytes = new TextEncoder().encode(symbol).length;
    if (symbolBytes > 10) {
      return jsonResponse(400, {
        success: false,
        error: `Token Symbol exceeds Metaplex limit of 10 UTF-8 bytes (got ${symbolBytes} bytes).`,
      }, cors);
    }

    // 7. Token Decimals Validation
    if (!/^[0-9]$/.test(decStr)) {
      return jsonResponse(400, {
        success: false,
        error: `Token Decimals must be an integer between 0 and 9 (got "${decStr}").`,
      }, cors);
    }
    const decimals = Number(decStr);

    // 8. Description Length
    if (description.length > 500) {
      return jsonResponse(400, {
        success: false,
        error: `Description exceeds maximum 500 characters.`,
      }, cors);
    }

    // 9. Supply Validation
    if (!/^[0-9]+(\.[0-9]+)?$/.test(supply)) {
      return jsonResponse(400, {
        success: false,
        error: `Invalid token supply: "${supply}". Supply must be a positive decimal number.`,
      }, cors);
    }

    // 10. URL Sanitization and Validation
    let cleanWebsite = '';
    let cleanTwitter = '';
    let cleanTelegram = '';
    let cleanDiscord = '';
    try {
      cleanWebsite = validateUrl(formData.get('website'), 'website');
      cleanTwitter = validateUrl(formData.get('twitter'), 'twitter');
      cleanTelegram = validateUrl(formData.get('telegram'), 'telegram');
      cleanDiscord = validateUrl(formData.get('discord'), 'discord');
    } catch (urlErr) {
      return jsonResponse(400, { success: false, error: urlErr.message }, cors);
    }

    // 11. Image Verification (Magic Bytes)
    let verifiedMime = '';
    if (imageFile !== null || requireImage) {
      try {
        verifiedMime = await verifyRasterImage(imageFile);
      } catch (imgErr) {
        return jsonResponse(400, { success: false, error: imgErr.message }, cors);
      }
    }

    // 12. Check Pinata credentials in Pages runtime environment
    const pinataJwt = env.PINATA_JWT;
    const pinataApiKey = env.PINATA_API_KEY;
    const pinataSecretKey = env.PINATA_SECRET_API_KEY;

    const hasJwt = Boolean(pinataJwt);
    const hasKeys = Boolean(pinataApiKey && pinataSecretKey);

    if (!hasJwt && !hasKeys) {
      return jsonResponse(400, {
        success: false,
        error: 'Pinata IPFS credentials are not configured on this environment. Cannot pin metadata.',
      }, cors);
    }

    const authHeaders = hasJwt
      ? { Authorization: `Bearer ${pinataJwt}` }
      : { pinata_api_key: pinataApiKey, pinata_secret_api_key: pinataSecretKey };

    let imageUri = '';
    if (verifiedMime) {
      try {
        const type = verifiedMime.slice('image/'.length);
        imageUri = await pinFile(imageFile.slice(0, imageFile.size, verifiedMime), `token_logo.${type}`, authHeaders);
      } catch {
        return jsonResponse(502, { success: false, error: 'IPFS image pinning failed.' }, cors);
      }
    }

    // 14. Build Standard Metaplex Metadata V3 JSON
    const metadataPayload = {
      name,
      symbol,
      description,
      image: imageUri,
      seller_fee_basis_points: 0,
      attributes: [],
      properties: {
        files: imageUri ? [{ uri: imageUri, type: verifiedMime }] : [],
        category: 'image',
        creators: [],
      },
      extensions: {
        ...(cleanWebsite ? { website: cleanWebsite } : {}),
        ...(cleanTwitter ? { twitter: cleanTwitter } : {}),
        ...(cleanTelegram ? { telegram: cleanTelegram } : {}),
        ...(cleanDiscord ? { discord: cleanDiscord } : {}),
      },
    };

    let metadataUri;
    try {
      const metaBlob = new Blob([JSON.stringify(metadataPayload, null, 2)], { type: 'application/json' });
      metadataUri = await pinFile(metaBlob, 'metadata.json', authHeaders);
    } catch {
      return jsonResponse(502, { success: false, error: 'IPFS metadata pinning failed.' }, cors);
    }

    return jsonResponse(200, {
      success: true,
      imageUri,
      metadataUri,
      token: {
        name,
        symbol,
        decimals,
        supply,
      },
    }, cors);
  } catch (err) {
    console.error('Unexpected handler error in upload-metadata:', err);
    return jsonResponse(500, {
      success: false,
      error: 'An internal error occurred while processing metadata. Please retry.',
    }, cors);
  }
}
