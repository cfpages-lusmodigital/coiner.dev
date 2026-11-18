import { PINATA_GATEWAY, pinnedFileUri, readPinningJson, SCOUT_UPLOAD_TOKEN_FORMAT } from './ipfsMetadata.js';

export async function publishScoutMetadata(staged, { name, symbol, decimals, supply, token }) {
  if (!staged?.imageValid || !staged.image) {
    throw new Error('Auto-launch requires a validated image or an explicit --metadata-uri.');
  }
  if (typeof token !== 'string' || !SCOUT_UPLOAD_TOKEN_FORMAT.test(token)) {
    throw new Error('Set COINER_SCOUT_UPLOAD_TOKEN or provide an explicit --metadata-uri.');
  }
  const data = new FormData();
  data.set('name', name);
  data.set('symbol', symbol);
  data.set('supply', supply);
  data.set('decimals', String(decimals));
  data.set('description', staged.description);
  data.set('image', new Blob([staged.image.buffer], { type: staged.image.mimeType }), `icon.${staged.image.ext}`);

  // These optional profile links can be missing or invalid independently of the logo.
  for (const key of ['website', 'twitter', 'telegram']) {
    const raw = staged[`${key}Url`];
    if (typeof raw !== 'string' || raw.length > 100) continue;
    try {
      const url = new URL(raw);
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) data.set(key, raw);
    } catch {
      // Omit malformed links rather than forwarding them to the metadata service.
    }
  }

  const response = await fetch('https://coiner.dev/api/metadata', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: data,
    redirect: 'error',
    signal: AbortSignal.timeout(50000),
  });
  const payload = await readPinningJson(response);
  if (!payload || payload.success !== true ||
      typeof payload.metadataUri !== 'string' || !payload.metadataUri.startsWith(PINATA_GATEWAY) ||
      typeof payload.imageUri !== 'string' || !payload.imageUri.startsWith(PINATA_GATEWAY)) {
    throw new Error('Metadata publisher did not return pinned image and metadata URLs.');
  }
  pinnedFileUri(payload.imageUri.slice(PINATA_GATEWAY.length));
  return pinnedFileUri(payload.metadataUri.slice(PINATA_GATEWAY.length));
}
