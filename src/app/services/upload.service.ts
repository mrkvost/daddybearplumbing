/**
 * UploadService — uploads images directly to S3 using temporary Cognito credentials.
 *
 * Uses AWS Signature V4 via the S3 PutObject REST API.
 * No AWS SDK needed — signs requests manually with the temp credentials.
 */
import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private auth = inject(AuthService);

  /**
   * Upload a file to S3 gallery-photos/ prefix.
   * Returns the S3 key of the uploaded file.
   */
  async upload(file: File, filename: string): Promise<string> {
    const credentials = await this.auth.getCredentials();
    const key = `gallery-photos/${filename}`;
    const bucket = environment.aws.bucketName;
    const region = environment.aws.region;
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const url = `https://${host}/${key}`;

    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const shortDate = dateStamp.substring(0, 8);

    // Read file as ArrayBuffer for hashing
    const body = await file.arrayBuffer();
    const bodyHash = await this.sha256Hex(new Uint8Array(body));

    const headers: Record<string, string> = {
      'host': host,
      'x-amz-content-sha256': bodyHash,
      'x-amz-date': dateStamp,
      'x-amz-security-token': credentials.sessionToken,
      'content-type': file.type || 'application/octet-stream',
    };

    // Create canonical request
    const signedHeaderKeys = Object.keys(headers).sort();
    const signedHeaders = signedHeaderKeys.join(';');
    const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join('');

    const canonicalRequest = [
      'PUT',
      `/${key}`,
      '',
      canonicalHeaders,
      signedHeaders,
      bodyHash,
    ].join('\n');

    const scope = `${shortDate}/${region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      dateStamp,
      scope,
      await this.sha256Hex(new TextEncoder().encode(canonicalRequest)),
    ].join('\n');

    // Derive signing key
    const kDate = await this.hmac(`AWS4${credentials.secretAccessKey}`, shortDate);
    const kRegion = await this.hmacBinary(kDate, region);
    const kService = await this.hmacBinary(kRegion, 's3');
    const kSigning = await this.hmacBinary(kService, 'aws4_request');

    const signature = await this.hmacHex(kSigning, stringToSign);

    const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...headers,
        'Authorization': authorization,
      },
      body: body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    return key;
  }

  /**
   * Server-side copy within S3 (no data transfer through browser).
   * Used for reordering — copies to new key, then caller deletes the old key.
   */
  async copy(sourceFilename: string, destFilename: string): Promise<void> {
    const credentials = await this.auth.getCredentials();
    const destKey = `gallery-photos/${destFilename}`;
    const bucket = environment.aws.bucketName;
    const region = environment.aws.region;
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const url = `https://${host}/${destKey}`;
    const copySource = `/${bucket}/gallery-photos/${sourceFilename}`;

    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const shortDate = dateStamp.substring(0, 8);

    const bodyHash = await this.sha256Hex(new Uint8Array(0));

    const headers: Record<string, string> = {
      'host': host,
      'x-amz-content-sha256': bodyHash,
      'x-amz-copy-source': copySource,
      'x-amz-date': dateStamp,
      'x-amz-security-token': credentials.sessionToken,
    };

    const signedHeaderKeys = Object.keys(headers).sort();
    const signedHeaders = signedHeaderKeys.join(';');
    const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join('');

    const canonicalRequest = ['PUT', `/${destKey}`, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');

    const scope = `${shortDate}/${region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', dateStamp, scope, await this.sha256Hex(new TextEncoder().encode(canonicalRequest))].join('\n');

    const kDate = await this.hmac(`AWS4${credentials.secretAccessKey}`, shortDate);
    const kRegion = await this.hmacBinary(kDate, region);
    const kService = await this.hmacBinary(kRegion, 's3');
    const kSigning = await this.hmacBinary(kService, 'aws4_request');
    const signature = await this.hmacHex(kSigning, stringToSign);
    const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Authorization': authorization },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Copy failed: ${response.status} ${text}`);
    }
  }

  /**
   * Delete a file from S3 gallery-photos/ prefix.
   */
  async delete(filename: string): Promise<void> {
    const credentials = await this.auth.getCredentials();
    const key = `gallery-photos/${filename}`;
    const bucket = environment.aws.bucketName;
    const region = environment.aws.region;
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const url = `https://${host}/${key}`;

    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const shortDate = dateStamp.substring(0, 8);

    const bodyHash = await this.sha256Hex(new Uint8Array(0));

    const headers: Record<string, string> = {
      'host': host,
      'x-amz-content-sha256': bodyHash,
      'x-amz-date': dateStamp,
      'x-amz-security-token': credentials.sessionToken,
    };

    const signedHeaderKeys = Object.keys(headers).sort();
    const signedHeaders = signedHeaderKeys.join(';');
    const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join('');

    const canonicalRequest = [
      'DELETE',
      `/${key}`,
      '',
      canonicalHeaders,
      signedHeaders,
      bodyHash,
    ].join('\n');

    const scope = `${shortDate}/${region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      dateStamp,
      scope,
      await this.sha256Hex(new TextEncoder().encode(canonicalRequest)),
    ].join('\n');

    const kDate = await this.hmac(`AWS4${credentials.secretAccessKey}`, shortDate);
    const kRegion = await this.hmacBinary(kDate, region);
    const kService = await this.hmacBinary(kRegion, 's3');
    const kSigning = await this.hmacBinary(kService, 'aws4_request');

    const signature = await this.hmacHex(kSigning, stringToSign);
    const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...headers,
        'Authorization': authorization,
      },
    });

    if (!response.ok && response.status !== 204) {
      const text = await response.text();
      throw new Error(`Delete failed: ${response.status} ${text}`);
    }
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
