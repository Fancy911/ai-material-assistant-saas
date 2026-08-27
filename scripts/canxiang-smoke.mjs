#!/usr/bin/env node
/**
 * DEV-00 real-provider smoke test. It never prints the token or full source URL.
 * Set CANXIANG_TOKEN and one CANXIANG_SAMPLE_* variable for each capability.
 */
import { createHash } from 'node:crypto';

const baseUrl = (process.env.CANXIANG_BASE_URL || 'https://api.cxzja.cn').replace(/\/$/, '');
const token = process.env.CANXIANG_TOKEN;
const targets = [
  ['doubao', '/api/doubaovideo'],
  ['douyin', '/api/douyin'],
  ['xhs', '/api/xhs'],
  ['qianwen', '/api/qw'],
];

const redact = (url) => {
  const parsed = new URL(url);
  return { host: parsed.host, urlHash: createHash('sha256').update(url).digest('hex').slice(0, 12) };
};

const result = { generatedAt: new Date().toISOString(), baseUrl, tokenConfigured: Boolean(token), results: [] };
for (const [capability, path] of targets) {
  const sample = process.env[`CANXIANG_SAMPLE_${capability.toUpperCase()}`];
  if (!token || !sample) {
    result.results.push({ capability, status: 'BLOCKED', reason: !token ? 'CANXIANG_TOKEN is not configured' : `CANXIANG_SAMPLE_${capability.toUpperCase()} is not configured` });
    continue;
  }
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url: sample }),
      signal: AbortSignal.timeout(Number(process.env.CANXIANG_TIMEOUT_MS || 12000)),
    });
    const body = await response.json().catch(() => ({ nonJson: true }));
    result.results.push({ capability, status: response.ok ? 'PASS' : 'FAIL', httpStatus: response.status, latencyMs: Date.now() - started, sample: redact(sample), responseShape: body && typeof body === 'object' ? Object.keys(body).sort() : typeof body });
  } catch (error) {
    result.results.push({ capability, status: 'FAIL', latencyMs: Date.now() - started, sample: redact(sample), error: error instanceof Error ? error.name : 'UnknownError' });
  }
}
console.log(JSON.stringify(result, null, 2));
if (result.results.some((entry) => entry.status === 'FAIL')) process.exitCode = 1;

