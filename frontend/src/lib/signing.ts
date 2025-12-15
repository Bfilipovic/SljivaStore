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

export async function signedFetch(input, init = {}, mnemonicOrPassword: string) {
  // If mnemonicOrPassword is a mnemonic (12 words), use it directly
  // Otherwise, treat it as a session password and get mnemonic from session
  let mnemonic: string;
  if (mnemonicOrPassword.split(' ').length === 12) {
    mnemonic = mnemonicOrPassword;
  } else {
    mnemonic = await getMnemonicFromSession(mnemonicOrPassword);
  }
  
  const wallet = getEthWalletFromMnemonic(mnemonic);
  const url = typeof input === 'string' ? input : input.url;
  const method = (init.method || 'GET').toUpperCase();

  if (method === 'GET' || excludedPaths.some(path => url === path)) {
    return apiFetch(input, init);
  }

  let payload = {};
  if (init.body) {
    try {
      payload = JSON.parse(init.body);
    } catch {
      console.warn('signedFetch: failed to parse JSON body');
    }
  }

  const signedPayload = await signAndWrapPayload(wallet, payload);

  return apiFetch(url, {
    ...init,
    body: JSON.stringify(signedPayload),
    headers: { ...(init.headers || {}), 'Content-Type': 'application/json' },
  });
}
