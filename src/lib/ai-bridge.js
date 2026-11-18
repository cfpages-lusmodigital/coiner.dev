/**
 * ai-bridge.js — Sovereign AI Bridge Client Adapter for coiner.dev
 * 
 * Connects coiner-cli to Syamsul Alam's Unified AI Bridge (ai-bridge-codev)
 * to provide autonomous cognitive "thinking components" for coin creation:
 * - Narrative distillation & degen lore generation
 * - Ticker optimization & derivative spin formulation
 * - Virality & momentum scoring
 * - Dynamic exit parameter recommendations
 * 
 * Hardened per Engineer Sol Audit COINER-SCOUT-AI-1 (S02, S05, S06, S07).
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { Buffer } from 'node:buffer';

export const DEFAULT_AI_BRIDGE_URL = process.env.AI_BRIDGE_URL || 'http://127.0.0.1:8126/v1/chat/completions';
export const PYTHON_BRIDGE_PATH = 'C:\\Users\\THINKPAD\\Documents\\GitHub\\ai-bridge-codev\\src\\python';
export const MAX_AI_RESPONSE_BYTES = 512 * 1024; // 512 KB limit on AI completions

/**
 * Truncates a string to a maximum UTF-8 byte length safely without breaking multibyte characters
 * and without introducing Unicode replacement characters (\uFFFD)
 */
export function truncateUtf8Bytes(str, maxBytes) {
  if (!str) return '';
  const s = String(str);
  let totalBytes = 0;
  let result = '';
  for (const char of s) {
    const charBytes = Buffer.byteLength(char, 'utf8');
    if (totalBytes + charBytes > maxBytes) break;
    totalBytes += charBytes;
    result += char;
  }
  return result;
}

/**
 * Executes a completion request against the HTTP loopback server with full-body deadline
 */
export async function queryHttpBridge(prompt, timeoutMs = 20000, bridgeUrl = DEFAULT_AI_BRIDGE_URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(bridgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: String(prompt || '') }],
        timeout: Math.max(1, Math.floor(timeoutMs / 1000)),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let errText = '';
      const errReader = res.body?.getReader();
      if (errReader) {
        try {
          const { value } = await errReader.read();
          if (value) errText = Buffer.from(value.slice(0, 500)).toString('utf8');
          errReader.cancel();
        } catch {}
      }
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    // Stream and enforce MAX_AI_RESPONSE_BYTES to prevent memory exhaustion
    const reader = res.body?.getReader();
    let receivedBytes = 0;
    const chunks = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.length;
          if (receivedBytes > MAX_AI_RESPONSE_BYTES) {
            reader.cancel();
            throw new Error(`AI Bridge response exceeded ${MAX_AI_RESPONSE_BYTES} bytes limit`);
          }
          chunks.push(value);
        }
      }
    }

    const rawBody = Buffer.concat(chunks).toString('utf8');
    const data = JSON.parse(rawBody);
    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : (content ? JSON.stringify(content) : '');

    return {
      ok: true,
      text,
      engine: 'http-bridge',
      model: typeof data?.model === 'string' ? data.model : 'ai-bridge',
    };
  } catch (err) {
    return {
      ok: false,
      text: '',
      error: err.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a completion request via direct Python runner invoking ai_bridge.cascade
 */
export function queryPythonBridge(prompt, timeoutMs = 25000) {
  try {
    const script = `
import sys, json
sys.path.insert(0, r"${PYTHON_BRIDGE_PATH}")
try:
    from ai_bridge import cascade
    prompt = json.loads(sys.argv[1])
    res = cascade.complete(prompt)
    out = {
        "ok": bool(res.ok),
        "text": str(res.text or ""),
        "engine": str(res.engine or "cascade"),
        "model": str(res.model or "unknown"),
        "latency_ms": int(res.latency_ms or 0),
        "error": str(res.error or "")
    }
    print(json.dumps(out))
except Exception as exc:
    print(json.dumps({"ok": False, "error": str(exc)}))
`.trim();

    const proc = spawnSync('python', ['-c', script, JSON.stringify(String(prompt || ''))], {
      cwd: PYTHON_BRIDGE_PATH,
      env: {
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT || '',
        PYTHONUNBUFFERED: '1',
      },
      timeout: timeoutMs,
      encoding: 'utf-8',
      windowsHide: true,
      maxBuffer: MAX_AI_RESPONSE_BYTES,
    });

    if (proc.error) {
      return { ok: false, error: proc.error.message };
    }

    if (proc.status !== 0) {
      return { ok: false, error: `Python exit status ${proc.status}: ${(proc.stderr || '').slice(0, 300)}` };
    }

    const stdout = (proc.stdout || '').trim();
    if (!stdout) {
      return { ok: false, error: proc.stderr || 'Empty python stdout' };
    }

    // Extract JSON line
    const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
    const lastLine = lines[lines.length - 1];
    const data = JSON.parse(lastLine);

    if (typeof data !== 'object' || data === null || typeof data.ok !== 'boolean' || typeof data.text !== 'string') {
      return { ok: false, error: 'Malformed response envelope from Python bridge' };
    }

    return data;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Universal AI Bridge query dispatcher with absolute total timeout budget
 */
export async function completeAiBridge(prompt, options = {}) {
  const totalBudgetMs = options.timeoutMs || 25000;
  const startTime = Date.now();

  // 1. Try loopback HTTP server
  const httpBudget = Math.min(15000, totalBudgetMs);
  const httpRes = await queryHttpBridge(prompt, httpBudget);
  if (httpRes.ok && httpRes.text) {
    return httpRes;
  }

  // Calculate remaining budget for fallback
  const elapsed = Date.now() - startTime;
  const remainingBudget = totalBudgetMs - elapsed;

  if (remainingBudget > 2000) {
    // 2. Try direct Python cascade runner with remaining budget
    const pyRes = queryPythonBridge(prompt, remainingBudget);
    if (pyRes.ok && pyRes.text) {
      return pyRes;
    }
  }

  // 3. Fallback exhausted
  return {
    ok: false,
    text: '',
    error: `Cascade exhausted. HTTP: ${httpRes.error || 'unreachable'}`,
  };
}

/**
 * Cleans markdown fences and parses JSON safely with strict type guards
 */
export function extractJsonFromText(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    let text = raw.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Cognitive Thinking Component: Refines narrative, generates degen lore, ticker, and parameters.
 * Enforces strict UTF-8 byte limits (32 bytes name, 10 bytes symbol), finite ordered exit values,
 * and fail-safe heuristic fallback (S05, S06).
 */
export async function refineCoinNarrative(rawCoin) {
  const inputName = typeof rawCoin?.name === 'string' ? rawCoin.name.trim() : String(rawCoin?.name || 'Viral Meme').trim();
  const rawSymbol = typeof rawCoin?.symbol === 'string' ? rawCoin.symbol.trim() : String(rawCoin?.symbol || 'MEME').trim();
  const inputSymbol = rawSymbol.replace(/^\$/, '');
  const inputDesc = typeof rawCoin?.description === 'string' ? rawCoin.description.trim() : '';
  const inputSocial = typeof rawCoin?.twitterUrl === 'string' ? rawCoin.twitterUrl.trim() : '';

  const prompt = `
You are the master degen narrative architect for Solana meme coins on pump.fun.
Analyze this trending meme signal and synthesize high-converting token metadata.

Input Token Signal:
- Name: "${inputName.slice(0, 64)}"
- Symbol: "${inputSymbol.slice(0, 16)}"
- Description: "${inputDesc.slice(0, 200)}"
- Viral Source: "${inputSocial.slice(0, 120)}"

Output a strict, single JSON object with the following fields:
{
  "name": "Punchy meme name (max 32 bytes UTF-8, funny, high-conversion)",
  "symbol": "3-6 letter uppercase ticker without $ prefix (e.g. PEPE, AGENT, DOGE)",
  "description": "High-converting, degen-friendly trench lore (max 200 chars). Humorous, exciting, viral.",
  "derivativeAngle": "Brief explanation of why this derivative catches the current narrative wave",
  "viralityScore": 85,
  "suggestedTp1": 2.0,
  "suggestedTp2": 3.5,
  "suggestedSl": 0.70
}

Return ONLY valid JSON. Zero markdown text outside the JSON object.
`.trim();

  let aiResult = null;
  try {
    const res = await completeAiBridge(prompt, { timeoutMs: 25000 });
    if (res.ok && res.text) {
      const parsed = extractJsonFromText(res.text);
      if (parsed) {
        aiResult = { parsed, engine: res.engine, model: res.model };
      }
    }
  } catch {
    // Proceed to fallback
  }

  if (aiResult?.parsed) {
    const p = aiResult.parsed;
    const rawAiName = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : inputName;
    const rawAiSymbol = typeof p.symbol === 'string' && p.symbol.trim() ? p.symbol.trim().toUpperCase().replace(/^\$/, '') : inputSymbol.toUpperCase();
    const rawAiDesc = typeof p.description === 'string' && p.description.trim() ? p.description.trim() : `Autonomous viral meme coin on Solana.`;
    const derivativeAngle = typeof p.derivativeAngle === 'string' ? p.derivativeAngle.slice(0, 150) : 'Trending narrative wave';

    // Strict UTF-8 byte boundary enforcement and alphanumeric ticker grammar (S05, P12)
    const cleanAiSymbol = rawAiSymbol.replace(/[^A-Z0-9]/g, '');
    const name = truncateUtf8Bytes(rawAiName, 32);
    const symbol = truncateUtf8Bytes(cleanAiSymbol || inputSymbol || 'MEME', 10);
    const description = rawAiDesc.slice(0, 200);

    // Strict numeric bounds & ordering enforcement with post-rounding guarantees (S05)
    const rawScore = Number(p.viralityScore);
    const viralityScore = Number.isFinite(rawScore) && rawScore >= 1 && rawScore <= 100 ? Math.round(rawScore) : 75;

    const rawTp1 = Number(p.suggestedTp1);
    const suggestedTp1 = Number.isFinite(rawTp1) && rawTp1 >= 1.05 && rawTp1 <= 10.0 ? Number(rawTp1.toFixed(2)) : 2.0;

    const rawTp2 = Number(p.suggestedTp2);
    let candidateTp2 = Number.isFinite(rawTp2) && rawTp2 > suggestedTp1 && rawTp2 <= 20.0 ? Number(rawTp2.toFixed(2)) : Number((suggestedTp1 * 1.75).toFixed(2));
    if (candidateTp2 <= suggestedTp1) {
      candidateTp2 = Number((suggestedTp1 + 0.5).toFixed(2));
    }
    const suggestedTp2 = candidateTp2;

    const rawSl = Number(p.suggestedSl);
    let candidateSl = Number.isFinite(rawSl) && rawSl > 0.1 && rawSl < 1.0 ? Number(rawSl.toFixed(2)) : 0.70;
    if (candidateSl >= 1.0) {
      candidateSl = 0.95;
    }
    const suggestedSl = candidateSl;

    if (name && symbol) {
      return {
        success: true,
        source: 'ai-bridge',
        engine: aiResult.engine,
        model: aiResult.model,
        name,
        symbol,
        description,
        derivativeAngle,
        viralityScore,
        suggestedTp1,
        suggestedTp2,
        suggestedSl,
      };
    }
  }

  // Deterministic Heuristic Fallback with guaranteed safe UTF-8 byte bounds and finite numbers
  const safeName = truncateUtf8Bytes(inputName || 'Viral Coin', 32);
  const safeSymbol = truncateUtf8Bytes((inputSymbol || 'COIN').toUpperCase(), 10);

  return {
    success: true,
    source: 'heuristic-fallback',
    engine: 'deterministic-rules',
    model: 'none',
    name: safeName,
    symbol: safeSymbol,
    description: inputDesc ? inputDesc.slice(0, 200) : `The most based ${safeName} on Solana. Trench approved.`,
    derivativeAngle: 'Organic trench momentum',
    viralityScore: 70,
    suggestedTp1: 2.0,
    suggestedTp2: 3.5,
    suggestedSl: 0.70,
  };
}
