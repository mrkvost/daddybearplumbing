/**
 * UploadService — uploads/deletes/copies files in S3 using temporary Cognito credentials.
 * Uses AWS Signature V4 signed requests directly — no AWS SDK needed.
 */
import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private auth = inject(AuthService);
  private region = environment.aws.region;

  async upload(file: File, filename: string, bucket: string): Promise<string> {
    const credentials = await this.auth.getCredentials();
    const host = `${bucket}.s3.${this.region}.amazonaws.com`;
    const url = `https://${host}/${filename}`;

    const body = await file.arrayBuffer();
    const bodyHash = await this.sha256Hex(new Uint8Array(body));

    const headers: Record<string, string> = {
      'host': host,
      'x-amz-content-sha256': bodyHash,
      'x-amz-date': this.amzDate(),
      'x-amz-security-token': credentials.sessionToken,
      'content-type': file.type || 'application/octet-stream',
    };

    const response = await this.signedRequest('PUT', host, filename, headers, bodyHash, credentials, body);
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
    }
    return filename;
  }

  async copy(sourceFilename: string, destFilename: string, bucket: string): Promise<void> {
    const credentials = await this.auth.getCredentials();
    const host = `${bucket}.s3.${this.region}.amazonaws.com`;
    const bodyHash = await this.sha256Hex(new Uint8Array(0));

    const headers: Record<string, string> = {
      'host': host,
      'x-amz-content-sha256': bodyHash,
      'x-amz-copy-source': `/${bucket}/${sourceFilename}`,
      'x-amz-date': this.amzDate(),
      'x-amz-security-token': credentials.sessionToken,
    };

    const response = await this.signedRequest('PUT', host, destFilename, headers, bodyHash, credentials);
    if (!response.ok) {
      throw new Error(`Copy failed: ${response.status} ${await response.text()}`);
    }
  }

  async delete(filename: string, bucket: string): Promise<void> {
    const credentials = await this.auth.getCredentials();
    const host = `${bucket}.s3.${this.region}.amazonaws.com`;
    const bodyHash = await this.sha256Hex(new Uint8Array(0));

    const headers: Record<string, string> = {
      'host': host,
      'x-amz-content-sha256': bodyHash,
      'x-amz-date': this.amzDate(),
      'x-amz-security-token': credentials.sessionToken,
    };

    const response = await this.signedRequest('DELETE', host, filename, headers, bodyHash, credentials);
    if (!response.ok && response.status !== 204) {
      throw new Error(`Delete failed: ${response.status} ${await response.text()}`);
    }
  }

  async putJson(filename: string, data: unknown, bucket: string): Promise<void> {
    const credentials = await this.auth.getCredentials();
    const host = `${bucket}.s3.${this.region}.amazonaws.com`;
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const body = encoded.buffer as ArrayBuffer;
    const bodyHash = await this.sha256Hex(encoded);

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'host': host,
      'x-amz-content-sha256': bodyHash,
      'x-amz-date': this.amzDate(),
      'x-amz-security-token': credentials.sessionToken,
    };

    const response = await this.signedRequest('PUT', host, filename, headers, bodyHash, credentials, body);
    if (!response.ok) {
      throw new Error(`Put failed: ${response.status} ${await response.text()}`);
    }
  }

  /* ---------- SigV4 internals ---------- */

  private async signedRequest(
    method: string, host: string, key: string,
    headers: Record<string, string>, bodyHash: string,
    credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string },
    body?: ArrayBuffer,
  ): Promise<Response> {
    const dateStamp = headers['x-amz-date'];
    const shortDate = dateStamp.substring(0, 8);

    const signedHeaderKeys = Object.keys(headers).sort();
    const signedHeaders = signedHeaderKeys.join(';');
    const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join('');

    const canonicalRequest = [method, `/${key}`, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');

    const scope = `${shortDate}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256', dateStamp, scope,
      await this.sha256Hex(new TextEncoder().encode(canonicalRequest)),
    ].join('\n');

    const kDate = await this.hmac(`AWS4${credentials.secretAccessKey}`, shortDate);
    const kRegion = await this.hmacBinary(kDate, this.region);
    const kService = await this.hmacBinary(kRegion, 's3');
    const kSigning = await this.hmacBinary(kService, 'aws4_request');
    const signature = await this.hmacHex(kSigning, stringToSign);

    const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return fetch(`https://${host}/${key}`, {
      method,
      headers: { ...headers, 'Authorization': authorization },
      body: body ?? undefined,
    });
  }

  private amzDate(): string {
    return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  private async sha256Hex(data: Uint8Array): Promise<string> {
    const buf = new Uint8Array(data).buffer as ArrayBuffer;
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async hmac(key: string, data: string): Promise<ArrayBuffer> {
    const keyData = new TextEncoder().encode(key);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  }

  private async hmacBinary(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  }

  private async hmacHex(key: ArrayBuffer, data: string): Promise<string> {
    const result = await this.hmacBinary(key, data);
    return Array.from(new Uint8Array(result)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
