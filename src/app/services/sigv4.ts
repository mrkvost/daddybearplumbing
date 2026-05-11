/**
 * AWS Signature V4 signer for arbitrary HTTPS requests.
 *
 * Used to call AWS service endpoints (e.g. Lambda Function URLs with
 * AWS_IAM auth) directly from the browser, using temporary credentials
 * obtained from the Cognito Identity Pool.
 */

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

export interface SignedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: ArrayBuffer | Uint8Array;
  region: string;
  service: string;
  credentials: AwsCredentials;
}

export async function signAndFetch(req: SignedRequest): Promise<Response> {
  const u = new URL(req.url);
  const host = u.host;
  const path = u.pathname || '/';
  const query = canonicalQueryString(u.searchParams);

  const bodyBytes =
    req.body instanceof Uint8Array ? req.body :
    req.body ? new Uint8Array(req.body) :
    new Uint8Array(0);
  const bodyHash = await sha256Hex(bodyBytes);
  const amzDate = currentAmzDate();
  const shortDate = amzDate.substring(0, 8);

  const headers: Record<string, string> = {
    ...lowercaseKeys(req.headers),
    'host': host,
    'x-amz-content-sha256': bodyHash,
    'x-amz-date': amzDate,
    'x-amz-security-token': req.credentials.sessionToken,
  };

  const signedHeaderKeys = Object.keys(headers).sort();
  const signedHeaders = signedHeaderKeys.join(';');
  const canonicalHeaders = signedHeaderKeys
    .map(k => `${k}:${headers[k].trim()}\n`)
    .join('');

  const canonicalRequest = [
    req.method.toUpperCase(),
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');

  const scope = `${shortDate}/${req.region}/${req.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(new TextEncoder().encode(canonicalRequest)),
  ].join('\n');

  const kDate = await hmac(new TextEncoder().encode(`AWS4${req.credentials.secretAccessKey}`), shortDate);
  const kRegion = await hmac(kDate, req.region);
  const kService = await hmac(kRegion, req.service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = await hmacHex(kSigning, stringToSign);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${req.credentials.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(req.url, {
    method: req.method,
    headers: { ...headers, 'Authorization': authorization },
    body: bodyBytes.byteLength ? toArrayBuffer(bodyBytes) : undefined,
  });
}

function canonicalQueryString(params: URLSearchParams): string {
  const entries: [string, string][] = [];
  params.forEach((v, k) => entries.push([k, v]));
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return entries
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join('&');
}

function encodeRfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function lowercaseKeys(obj: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) out[k.toLowerCase()] = v;
  return out;
}

function currentAmzDate(): string {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

async function sha256Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', toArrayBuffer(data));
  return toHex(new Uint8Array(hash));
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', toArrayBuffer(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

function toArrayBuffer(src: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (src instanceof ArrayBuffer) return src;
  const out = new ArrayBuffer(src.byteLength);
  new Uint8Array(out).set(src);
  return out;
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  return toHex(new Uint8Array(await hmac(key, data)));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
