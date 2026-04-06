/**
 * AuthService — handles Cognito authentication for the admin area.
 *
 * Uses the AWS SDK directly (CognitoIdentityProvider + CognitoIdentity)
 * to authenticate users and obtain temporary S3 credentials.
 * No Amplify dependency — just the lightweight AWS SDK clients.
 */
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

const STORAGE_KEY = 'auth_tokens';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokens: AuthTokens | null = null;
  private credentials: AwsCredentials | null = null;

  constructor() {
    this.loadTokens();
  }

  get isAuthenticated(): boolean {
    return this.tokens !== null;
  }

  get idToken(): string | null {
    return this.tokens?.idToken ?? null;
  }

  private saveTokens(): void {
    if (this.tokens) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.tokens));
    }
  }

  private loadTokens(): void {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.tokens = JSON.parse(stored);
        if (this.isTokenExpired()) {
          this.refreshSession().catch(() => this.clearTokens());
        }
      }
    } catch { /* corrupted data, ignore */ }
  }

  private clearTokens(): void {
    this.tokens = null;
    this.credentials = null;
    sessionStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Sign in with username and password via Cognito USER_PASSWORD_AUTH flow.
   */
  async signIn(username: string, password: string): Promise<void> {
    const response = await fetch(
      `https://cognito-idp.${environment.aws.region}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        },
        body: JSON.stringify({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: environment.aws.cognitoClientId,
          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.__type) {
      throw new Error(data.message || 'Incorrect username or password');
    }

    if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      throw { code: 'NEW_PASSWORD_REQUIRED', session: data.Session };
    }

    this.tokens = {
      idToken: data.AuthenticationResult.IdToken,
      accessToken: data.AuthenticationResult.AccessToken,
      refreshToken: data.AuthenticationResult.RefreshToken,
    };
    this.saveTokens();
  }

  /**
   * Complete the NEW_PASSWORD_REQUIRED challenge (first login).
   */
  async completeNewPassword(username: string, newPassword: string, session: string): Promise<void> {
    const response = await fetch(
      `https://cognito-idp.${environment.aws.region}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
        },
        body: JSON.stringify({
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          ClientId: environment.aws.cognitoClientId,
          ChallengeResponses: {
            USERNAME: username,
            NEW_PASSWORD: newPassword,
          },
          Session: session,
        }),
      }
    );

    const data = await response.json();

    if (data.__type) {
      throw new Error(data.message || 'Password change failed');
    }

    this.tokens = {
      idToken: data.AuthenticationResult.IdToken,
      accessToken: data.AuthenticationResult.AccessToken,
      refreshToken: data.AuthenticationResult.RefreshToken,
    };
    this.saveTokens();
  }

  /**
   * Change password for the currently authenticated user.
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!this.tokens) throw new Error('Not authenticated');

    const response = await fetch(
      `https://cognito-idp.${environment.aws.region}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.ChangePassword',
        },
        body: JSON.stringify({
          AccessToken: this.tokens.accessToken,
          PreviousPassword: oldPassword,
          ProposedPassword: newPassword,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok || data.__type) {
      throw new Error(data.message || 'Password change failed');
    }
  }

  private isTokenExpired(): boolean {
    if (!this.tokens) return true;
    try {
      const payload = JSON.parse(atob(this.tokens.idToken.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch { return true; }
  }

  private async refreshSession(): Promise<void> {
    if (!this.tokens?.refreshToken) throw new Error('No refresh token');

    const response = await fetch(
      `https://cognito-idp.${environment.aws.region}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        },
        body: JSON.stringify({
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          ClientId: environment.aws.cognitoClientId,
          AuthParameters: {
            REFRESH_TOKEN: this.tokens.refreshToken,
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok || data.__type) {
      this.clearTokens();
      throw new Error('Session expired');
    }

    this.tokens = {
      idToken: data.AuthenticationResult.IdToken,
      accessToken: data.AuthenticationResult.AccessToken,
      refreshToken: this.tokens.refreshToken,
    };
    this.saveTokens();
  }

  /**
   * Get temporary AWS credentials via Cognito Identity Pool.
   */
  async getCredentials(): Promise<AwsCredentials> {
    if (!this.tokens) throw new Error('Not authenticated');

    if (this.isTokenExpired()) {
      await this.refreshSession();
    }

    // Step 1: Get identity ID
    const idResponse = await fetch(
      `https://cognito-identity.${environment.aws.region}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityService.GetId',
        },
        body: JSON.stringify({
          IdentityPoolId: environment.aws.identityPoolId,
          Logins: {
            [`cognito-idp.${environment.aws.region}.amazonaws.com/${environment.aws.userPoolId}`]:
              this.tokens.idToken,
          },
        }),
      }
    );
    const idData = await idResponse.json();

    // Step 2: Get credentials for that identity
    const credResponse = await fetch(
      `https://cognito-identity.${environment.aws.region}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity',
        },
        body: JSON.stringify({
          IdentityId: idData.IdentityId,
          Logins: {
            [`cognito-idp.${environment.aws.region}.amazonaws.com/${environment.aws.userPoolId}`]:
              this.tokens.idToken,
          },
        }),
      }
    );
    const credData = await credResponse.json();

    this.credentials = {
      accessKeyId: credData.Credentials.AccessKeyId,
      secretAccessKey: credData.Credentials.SecretKey,
      sessionToken: credData.Credentials.SessionToken,
    };

    return this.credentials;
  }

  signOut(): void {
    this.clearTokens();
  }
}
