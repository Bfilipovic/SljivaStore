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
const RPC_URL = "https://api.mainnet-beta.solana.com";

// --- Wallet derivation ---
export function getSolWalletFromMnemonic(mnemonic: string): InstanceType<typeof Keypair> {
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

/**
 * Send SOL from mnemonic to address
 * @throws Error with user-friendly message if balance is insufficient
 */
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

    try {
        const signature = await sendAndConfirmTransaction(connection, tx, [fromWallet], {
            commitment: "processed",
        });
        return signature;
    } catch (err: any) {
        // Try to extract "insufficient lamports" message
        const msg = String(err.message || "");
        const match = msg.match(/insufficient lamports (\d+), need (\d+)/);

        if (match) {
            const have = Number(match[1]);
            const need = Number(match[2]);
            const haveSol = have / 1e9;
            const needSol = need / 1e9;
            throw new Error(
                `Not enough SOL to complete this transaction.\n` +
                `Balance: ${haveSol.toFixed(4)} SOL, Required: ${needSol.toFixed(4)} SOL.`
            );

        }

        // Generic fallback
        throw new Error("Transaction failed. Please try again or check your SOL balance.");
    }
}

