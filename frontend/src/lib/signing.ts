// src/lib/signing.ts
import { keccak256, toUtf8Bytes } from 'ethers';
import { HDNodeWallet } from 'ethers';
import { apiFetch } from './api';
import { getEthWalletFromMnemonic } from './ethService';
import { getMnemonicFromSession } from './walletActions';

function deterministicStringify(obj: any): string {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  return JSON.stringify(obj, Object.keys(obj).sort());
}

export async function signAndWrapPayload(wallet: HDNodeWallet, payload: any) {
  const timestamp = Date.now();
  const serialized = deterministicStringify({ timestamp, data: payload });
  const hash = keccak256(toUtf8Bytes(serialized));
  const signature = await wallet.signMessage(hash);

  return { address: wallet.address, timestamp, signature, data: payload };
}

const excludedPaths = ['/reservations'];

export async function signedFetch(
  input: string | Request | URL,
  init: RequestInit = {},
  mnemonicOrPassword: string
) {
  // If mnemonicOrPassword is a mnemonic (12 words), use it directly
  // Otherwise, treat it as a session password and get mnemonic from session
  let mnemonic: string;
  if (mnemonicOrPassword.split(' ').length === 12) {
    mnemonic = mnemonicOrPassword;
  } else {
    mnemonic = await getMnemonicFromSession(mnemonicOrPassword);
  }
  
  const wallet = getEthWalletFromMnemonic(mnemonic);
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
  const method = ((init.method || 'GET') as string).toUpperCase();

  if (method === 'GET' || excludedPaths.some(path => url === path)) {
    return apiFetch(url, init);
  }

  let payload: any = {};
  if (init.body) {
    try {
      const bodyStr = typeof init.body === 'string' ? init.body : await new Response(init.body).text();
      payload = JSON.parse(bodyStr);
    } catch {
      console.warn('signedFetch: failed to parse JSON body');
    }
  }

  const signedPayload = await signAndWrapPayload(wallet, payload);

  return apiFetch(url, {
    ...init,
    body: JSON.stringify(signedPayload),
    headers: { ...(init.headers as Record<string, string> || {}), 'Content-Type': 'application/json' },
  });
}
