import bs58 from 'bs58';

export const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
export const MAX_PIN_RESPONSE_BYTES = 16 * 1024;
export const SCOUT_UPLOAD_TOKEN_FORMAT = /^[A-Za-z0-9_-]{43,128}$/;

export function pinnedFileUri(cid) {
  if (typeof cid !== 'string' || !/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)) {
    throw new Error('Pinning did not return a valid CIDv0.');
  }
  const multihash = bs58.decode(cid);
  if (multihash.length !== 34 || multihash[0] !== 0x12 || multihash[1] !== 0x20) {
    throw new Error('Pinning did not return a valid CIDv0.');
  }
  return PINATA_GATEWAY + cid;
}

export class BodyTooLargeError extends Error {}

export async function readBoundedBody(message, maxBytes, signal) {
  signal?.throwIfAborted();
  if (Number(message.headers.get('content-length')) > maxBytes) {
    await message.body?.cancel().catch(() => {});
    throw new BodyTooLargeError('Request or response body exceeds the size limit.');
  }
  if (!message.body) return new Uint8Array();
  const reader = message.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new BodyTooLargeError('Request or response body exceeds the size limit.');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readPinningJson(response) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('IPFS pinning request failed.');
  }
  return JSON.parse(new TextDecoder().decode(await readBoundedBody(response, MAX_PIN_RESPONSE_BYTES)));
}
