import assert from 'node:assert/strict';
import { Resolver } from 'node:dns/promises';
import { EventEmitter } from 'node:events';
import https from 'node:https';
import { PassThrough } from 'node:stream';
import bs58 from 'bs58';

export const fixtureAddress = '1'.repeat(32);
export const fixtureLogo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1sAAAAASUVORK5CYII=', 'base64');
export const fixtureToken = 'A'.repeat(43);
export const imageCid = bs58.encode(Uint8Array.from([0x12, 0x20, ...Array(32).fill(1)]));
export const metadataCid = bs58.encode(Uint8Array.from([0x12, 0x20, ...Array(32).fill(2)]));
export const imageUrl = 'https://images.example.invalid/sample.png';

export function marketFixture(url) {
  if (url.href === imageUrl) return { body: fixtureLogo };
  assert.equal(url.hostname, 'api.dexscreener.com');
  if (url.pathname.startsWith('/latest/dex/tokens/')) {
    assert.ok(url.pathname.endsWith(fixtureAddress));
    return { body: JSON.stringify({ pairs: [{
      chainId: 'solana',
      baseToken: { address: fixtureAddress, name: 'Fixture Coin', symbol: 'FC' },
      volume: { h24: 10 },
      info: { imageUrl },
    }] }) };
  }
  return { body: JSON.stringify([{ chainId: 'solana', tokenAddress: fixtureAddress, totalAmount: 1 }]) };
}

export function installScoutTransport(
  responseFor,
  { addresses = ['93.184.215.14'], assertRequest = () => {} } = {},
) {
  const originals = [Resolver.prototype.resolve4, Resolver.prototype.resolve6, https.request];
  Resolver.prototype.resolve4 = async () => addresses;
  Resolver.prototype.resolve6 = async () => [];
  https.request = (url, options, onResponse) => {
    const request = new EventEmitter();
    request.end = () => {
      assert.equal(options.agent, false);
      assert.equal(options.autoSelectFamily, false);
      options.lookup(url.hostname, {}, (_error, address) => assert.equal(address, addresses[0]));
      assertRequest(url, options);
      const { status = 200, headers = {}, body, stall = false } = responseFor(url, options);
      const response = Object.assign(new PassThrough(), { statusCode: status, headers });
      const onAbort = () => response.destroy(options.signal.reason);
      options.signal.addEventListener('abort', onAbort, { once: true });
      response.once('close', () => options.signal.removeEventListener('abort', onAbort));
      onResponse(response);
      if (!stall) response.end(body);
    };
    return request;
  };
  return () => {
    [Resolver.prototype.resolve4, Resolver.prototype.resolve6, https.request] = originals;
  };
}
