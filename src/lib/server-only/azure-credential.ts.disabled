import 'server-only';

type DefaultAzureCredentialInstance = import('@azure/identity').DefaultAzureCredential;

let cachedCredentialPromise: Promise<DefaultAzureCredentialInstance> | null = null;

async function instantiateCredential(): Promise<DefaultAzureCredentialInstance> {
  const azureIdentity = await import('@azure/identity');
  const { DefaultAzureCredential } = azureIdentity;

  return new DefaultAzureCredential();
}

export interface AzureCredentialOptions {
  forceRefresh?: boolean;
}

export async function getDefaultAzureCredentialInstance(
  options?: AzureCredentialOptions
): Promise<DefaultAzureCredentialInstance> {
  if (options?.forceRefresh) {
    cachedCredentialPromise = null;
  }

  if (!cachedCredentialPromise) {
    cachedCredentialPromise = instantiateCredential();
  }

  return cachedCredentialPromise;
}

export async function getAzureAccessToken(scope: string | string[]): Promise<string> {
  const credential = await getDefaultAzureCredentialInstance();
  const token = await credential.getToken(scope);

  if (!token?.token) {
    throw new Error('Failed to acquire Azure access token for provided scope');
  }

  return token.token;
}
