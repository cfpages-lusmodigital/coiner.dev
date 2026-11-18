import { SCOUT_UPLOAD_TOKEN_FORMAT } from '../../src/lib/ipfsMetadata.js';
import { handleUploadMetadata } from './upload-metadata.js';

const encoder = new TextEncoder();
const challenge = encoder.encode('coiner-scout-upload');

async function bearerMatches(supplied, configured) {
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  const [expectedKey, candidateKey] = await Promise.all([
    crypto.subtle.importKey('raw', encoder.encode(configured), algorithm, false, ['verify']),
    crypto.subtle.importKey('raw', encoder.encode(supplied), algorithm, false, ['sign']),
  ]);
  const signature = await crypto.subtle.sign('HMAC', candidateKey, challenge);
  return crypto.subtle.verify('HMAC', expectedKey, signature, challenge);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const configured = env.COINER_SCOUT_UPLOAD_TOKEN;
  if (typeof configured !== 'string' || !SCOUT_UPLOAD_TOKEN_FORMAT.test(configured)) {
    return Response.json({ success: false, error: 'Scout upload is unavailable.' }, { status: 503 });
  }
  const supplied = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') || '')?.[1];
  if (!supplied || !SCOUT_UPLOAD_TOKEN_FORMAT.test(supplied) || !(await bearerMatches(supplied, configured))) {
    return Response.json({ success: false, error: 'Scout upload requires authorization.' }, { status: 401 });
  }
  return handleUploadMetadata(context, { requireImage: true });
}
