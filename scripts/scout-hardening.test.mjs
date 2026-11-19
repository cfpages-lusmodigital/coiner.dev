import assert from 'node:assert/strict';
import { Resolver } from 'node:dns/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { Connection, Keypair, Transaction } from '@solana/web3.js';
import { run } from '../bin/coiner-cli.js';
import { onRequestPost as privateUpload } from '../functions/api/metadata.js';
import { onRequestPost as browserUpload } from '../functions/api/upload-metadata.js';
import { pinnedFileUri } from '../src/lib/ipfsMetadata.js';
import {
  createScoutStagingRun, downloadAndValidateImage, scanTrendingTokens, stageScoutedProfile, MAX_IMAGE_BYTES,
} from '../src/lib/scout.js';
import {
  installScoutTransport, marketFixture, fixtureLogo, fixtureToken, imageUrl, imageCid, metadataCid,
} from './scout-fixtures.mjs';

const tempRoot = fs.realpathSync.native(os.tmpdir());
const scratch = fs.mkdtempSync(path.join(tempRoot, 'coiner-scout-test-'));

test.after(() => {
  assert.equal(path.dirname(scratch), tempRoot);
  fs.rmSync(scratch, { recursive: true, force: true });
});

test('S01 creates exclusive runs, refuses linked roots, and stages only within its run', async (t) => {
  t.after(installScoutTransport(marketFixture));
  const root = path.join(scratch, 'staging');
  const first = createScoutStagingRun(root);
  const second = createScoutStagingRun(root);
  assert.notEqual(first, second);
  const candidate = { name: 'Fixture', symbol: 'weird/symbol', imageUrl };
  const staged = await stageScoutedProfile(candidate, null, first, 1);
  assert.equal(path.dirname(staged.stagingDir), first);
  assert.deepEqual(fs.readFileSync(staged.localImagePath), fixtureLogo);
  assert.equal(JSON.parse(fs.readFileSync(staged.metadataPath, 'utf8')).image, 'icon.png');
  await assert.rejects(stageScoutedProfile({ ...candidate, imageUrl: '' }, null, first, 1), { code: 'EEXIST' });
  const linked = path.join(scratch, 'linked');
  fs.symlinkSync(root, linked, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => createScoutStagingRun(path.join(linked, 'nested')), /linked components/);
  assert.equal(fs.existsSync(path.join(root, 'nested')), false);
});

test('S02 and S03 preserve the hostname and bound the DNS, body and redirect lifecycles', async (t) => {
  const seen = [];
  const restore = installScoutTransport((url) => {
    if (url.pathname === '/redirect') return { status: 302, headers: { location: imageUrl } };
    if (url.pathname === '/large') return { body: Buffer.alloc(MAX_IMAGE_BYTES + 1) };
    if (url.pathname === '/stall') return { stall: true };
    return marketFixture(url);
  }, { assertRequest: (url, options) => seen.push([url, options]) });
  t.after(restore);
  assert.equal((await scanTrendingTokens())[0].symbol, 'FC');
  assert.deepEqual((await downloadAndValidateImage(imageUrl)).buffer, fixtureLogo);
  assert.equal(seen.at(-1)[0].hostname, 'images.example.invalid');
  assert.equal(seen[0][1].signal, seen[2][1].signal, 'both market phases share one deadline');

  const beforeRedirect = seen.length;
  await assert.rejects(downloadAndValidateImage(new URL('/redirect', imageUrl)), /HTTP 302/);
  assert.equal(seen.length, beforeRedirect + 1);
  await assert.rejects(downloadAndValidateImage(new URL('/large', imageUrl)), /exceeded/);
  const keepAlive = delay(75);
  await assert.rejects(downloadAndValidateImage(new URL('/stall', imageUrl), 20), { name: 'TimeoutError' });
  await keepAlive;

  const beforePrivate = seen.length;
  await assert.rejects(downloadAndValidateImage('https://[::1]/image.png'), /not a public IP/);
  assert.equal(seen.length, beforePrivate);
});

test('S02 cancels DNS lookups when the deadline expires before a connection', async (t) => {
  const pending = [];
  const keepAlive = delay(75);
  const lookup = () => new Promise((_resolve, reject) => pending.push(reject));
  t.mock.method(Resolver.prototype, 'resolve4', lookup);
  t.mock.method(Resolver.prototype, 'resolve6', lookup);
  const cancel = t.mock.method(Resolver.prototype, 'cancel', () => {
    for (const reject of pending) reject(new Error('fixture DNS cancelled'));
  });
  await assert.rejects(downloadAndValidateImage(imageUrl, 20), { name: 'TimeoutError' });
  assert.equal(cancel.mock.callCount(), 1);
  assert.equal(pending.length, 2);
  await keepAlive;
});

function uploadRequest(token, { withImage = true } = {}) {
  const data = new FormData();
  data.set('name', 'Fixture');
  data.set('symbol', 'FC');
  if (withImage) data.set('image', new Blob([fixtureLogo], { type: 'image/png' }), 'sample.png');
  return new Request('https://example.invalid/api/metadata', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: data,
  });
}

test('S04 gates scout publishing and pins the actual image before constructing JSON', async (t) => {
  const seen = [];
  let mode = 'ok';
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.pinata.cloud/pinning/pinFileToIPFS');
    assert.equal(options.redirect, 'error');
    assert.equal(JSON.parse(options.body.get('pinataOptions')).cidVersion, 0);
    const file = options.body.get('file');
    if (file.type === 'image/png') {
      seen.push(Buffer.from(await file.arrayBuffer()));
      return Response.json({ IpfsHash: mode === 'malformed' ? 'Qm-invalid' : imageCid });
    }
    seen.push(JSON.parse(await file.text()));
    return Response.json({ IpfsHash: metadataCid });
  });
  const env = { COINER_SCOUT_UPLOAD_TOKEN: fixtureToken, PINATA_JWT: 'fixture-only' };
  assert.equal((await privateUpload({ request: uploadRequest(), env })).status, 401);
  assert.equal((await privateUpload({ request: uploadRequest('B'.repeat(43)), env })).status, 401);
  assert.equal((await privateUpload({ request: uploadRequest(fixtureToken), env: {} })).status, 503);
  assert.equal((await privateUpload({ request: uploadRequest(fixtureToken, { withImage: false }), env })).status, 400);
  const largeBody = new Request('https://example.invalid/api/metadata', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${fixtureToken}`,
      'Content-Type': 'multipart/form-data; boundary=fixture',
    },
    body: new Uint8Array(5.5 * 1024 * 1024 + 1),
  });
  assert.equal((await privateUpload({ request: largeBody, env })).status, 413);
  assert.equal(seen.length, 0);
  const response = await privateUpload({ request: uploadRequest(fixtureToken), env });
  assert.equal(response.status, 200);
  assert.deepEqual(seen[0], fixtureLogo);
  assert.equal(seen[1].image, pinnedFileUri(imageCid));
  assert.equal((await response.json()).metadataUri, pinnedFileUri(metadataCid));
  mode = 'malformed';
  assert.equal((await privateUpload({ request: uploadRequest(fixtureToken), env })).status, 502);
  assert.equal(seen.length, 3);
  assert.equal((await browserUpload({ request: uploadRequest(null, { withImage: false }), env })).status, 200);
});

test('S04 CLI validates pinning before signing and emits verifiable transaction signatures', async (t) => {
  let mode;
  let pinCalls = 0;
  let signingAttempts = 0;
  let verifiedWireTransactions = 0;
  const output = [];
  const explicitUri = 'https://example.invalid/published.json';
  t.after(installScoutTransport((url) => mode === 'invalid' && url.hostname === 'images.example.invalid'
    ? { body: 'bad image' } : marketFixture(url)));
  t.mock.method(console, 'log', (message) => output.push(String(message)));
  t.mock.method(console, 'error', (message) => output.push(String(message)));
  t.mock.method(Connection.prototype, 'getMinimumBalanceForRentExemption', async () => 2_000_000);
  t.mock.method(Connection.prototype, 'getBalance', async () => 2_000_000_000);
  t.mock.method(Connection.prototype, 'getLatestBlockhash', async () => ({
    blockhash: Keypair.generate().publicKey.toBase58(),
    lastValidBlockHeight: 123,
  }));
  t.mock.method(Connection.prototype, 'sendRawTransaction', async (bytes) => {
    assert.equal(mode, 'signed', 'unexpected submission attempt');
    const signed = Transaction.from(bytes);
    assert.equal(signed.signatures.length, 2, 'payer and mint signatures');
    assert.ok(signed.verifySignatures());
    assert.ok(signed.instructions.some((instruction) => instruction.data.includes(Buffer.from(pinnedFileUri(metadataCid)))));
    verifiedWireTransactions++;
    throw new Error('fixture verified signed bytes without submitting them');
  });
  const sign = Transaction.prototype.sign;
  t.mock.method(Transaction.prototype, 'sign', function (...signers) {
    signingAttempts++;
    assert.ok(['explicit', 'published', 'signed'].includes(mode), 'unexpected signing call');
    const expectedUri = mode === 'explicit' ? explicitUri : pinnedFileUri(metadataCid);
    assert.ok(this.instructions.some((instruction) => instruction.data.includes(Buffer.from(expectedUri))));
    if (mode === 'signed') {
      sign.apply(this, signers);
      assert.ok(this.verifySignatures());
      return;
    }
    throw new Error('fixture stopped before signing or broadcasting');
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    pinCalls++;
    assert.ok(['refused', 'published', 'signed'].includes(mode), 'unexpected outbound request');
    assert.equal(url, 'https://coiner.dev/api/metadata');
    assert.equal(options.headers.Authorization, `Bearer ${fixtureToken}`);
    assert.equal(options.redirect, 'error');
    assert.deepEqual(Buffer.from(await options.body.get('image').arrayBuffer()), fixtureLogo);
    if (mode === 'refused') return new Response(null, { status: 503 });
    return Response.json({ success: true, metadataUri: pinnedFileUri(metadataCid), imageUri: pinnedFileUri(imageCid) });
  });

  const keyfile = path.join(scratch, 'fixture-payer.json');
  fs.writeFileSync(keyfile, '', { flag: 'wx' });
  const fixtureKey = JSON.stringify(Array.from(Keypair.generate().secretKey));
  const readFileSync = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...options) =>
    file === keyfile ? fixtureKey : readFileSync(file, ...options));
  const expected = {
    invalid: /Downloaded image failed validation/,
    dry: /example\.invalid\/scout-dry-run/,
    refused: /IPFS pinning request failed/,
    published: /fixture stopped before signing or broadcasting/,
    explicit: /fixture stopped before signing or broadcasting/,
    signed: /fixture verified signed bytes without submitting them/,
  };
  const priorExitCode = process.exitCode;
  const priorToken = process.env.COINER_SCOUT_UPLOAD_TOKEN;
  try {
    for (const [current, pattern] of Object.entries(expected)) {
      mode = current;
      pinCalls = 0;
      signingAttempts = 0;
      verifiedWireTransactions = 0;
      output.length = 0;
      process.exitCode = 0;
      delete process.env.COINER_SCOUT_UPLOAD_TOKEN;
      if (['invalid', 'refused', 'published', 'signed'].includes(mode)) process.env.COINER_SCOUT_UPLOAD_TOKEN = fixtureToken;
      await run([
        'scout', '--limit', '1', '--auto-launch', '--no-ai-bridge', '--json', '--staging-dir', scratch,
        ...(mode === 'dry' ? ['--dry-run'] : ['--keypair', keyfile]),
        ...(mode === 'explicit' ? ['--metadata-uri', explicitUri] : []),
      ]);
      assert.match(output.join('\n'), pattern, mode);
      assert.equal(process.exitCode, mode === 'dry' ? 0 : 1, mode);
      assert.equal(pinCalls, ['refused', 'published', 'signed'].includes(mode) ? 1 : 0, mode);
      assert.equal(signingAttempts, ['explicit', 'published', 'signed'].includes(mode) ? 1 : 0, mode);
      assert.equal(verifiedWireTransactions, mode === 'signed' ? 1 : 0, mode);
    }
  } finally {
    process.exitCode = priorExitCode;
    if (priorToken === undefined) delete process.env.COINER_SCOUT_UPLOAD_TOKEN;
    else process.env.COINER_SCOUT_UPLOAD_TOKEN = priorToken;
  }
});
