import { HDNodeWallet, Mnemonic, Wallet } from 'ethers';
import { walletAddress } from '$lib/stores/wallet';


export function loginWalletFromMnemonic(mnemonic: string): string {
  const wallet = getWalletFromMnemonic(mnemonic);
  walletAddress.set(wallet.address);
  return wallet.address;
}

export function getWalletFromMnemonic(mnemonic: string): HDNodeWallet {
    return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic));
}

