import { mnemonicToSeedSync } from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import {
  Keypair,
  Connection,
  Transaction,
  SystemProgram,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";
const RPC_URL = "https://api.devnet.solana.com";

// --- Wallet derivation ---
export function getSolWalletFromMnemonic(mnemonic: string): Keypair {
  const seed = mnemonicToSeedSync(mnemonic); // Uint8Array
  const hd = HDKey.fromMasterSeed(seed).derive(SOLANA_DERIVATION_PATH);

  if (!hd.privateKey) {
    throw new Error("Failed to derive SOL key from mnemonic");
  }

  // Solana needs 32-byte seed for ed25519
  return Keypair.fromSeed(hd.privateKey.slice(0, 32));
}

export function getSolAddress(mnemonic: string): string {
  return getSolWalletFromMnemonic(mnemonic).publicKey.toBase58();
}

// --- Balance ---
export async function getSolBalance(
  address: string,
): Promise<number> {
  const connection = new Connection(RPC_URL);
  return connection.getBalance(new PublicKey(address)); // returns lamports
}

// --- Send transaction ---
export async function createSolTransaction(
  fromMnemonic: string,
  toAddress: string,
  lamports: number,
): Promise<string> {
  const connection = new Connection(RPC_URL);
  const fromWallet = getSolWalletFromMnemonic(fromMnemonic);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromWallet.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, tx, [fromWallet]);
  return signature;
}
