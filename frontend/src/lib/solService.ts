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

// Solana RPC endpoints (try in order, fallback if one fails)
const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com",
  "https://rpc.ankr.com/solana",
];

// Get RPC URL from environment or use default
function getRpcUrl(): string {
  const envUrl = import.meta.env.VITE_SOLANA_RPC_URL;
  if (envUrl) return envUrl;
  return RPC_ENDPOINTS[0];
}

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
    // Use configured RPC URL or default
    const rpcUrl = getRpcUrl();
    
    try {
        const connection = new Connection(rpcUrl, {
            commitment: "confirmed",
        });
        
        // Set a timeout for the request (10 seconds)
        const balance = await Promise.race([
            connection.getBalance(new PublicKey(address)),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error("Request timeout")), 10000)
            )
        ]);
        
        return balance; // returns lamports
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorString = String(error);
        
        // Check if it's a 403/forbidden/rate limit error (common with public RPC endpoints)
        const isRateLimited = errorMsg.includes("403") || 
                              errorMsg.includes("forbidden") || 
                              errorMsg.includes("Access forbidden") ||
                              errorString.includes('"code": 403') ||
                              errorString.includes('"code": 429');
        
        if (isRateLimited) {
            // Create a cleaner error that won't show the verbose JSON-RPC response
            const rateLimitError = new Error("Solana RPC endpoint is rate-limited");
            rateLimitError.name = "RateLimitError";
            throw rateLimitError;
        }
        
        // For other errors, provide a generic message (strip verbose JSON-RPC details)
        const cleanMsg = errorMsg.split('\n')[0].substring(0, 200); // Take first line, limit length
        throw new Error(`Failed to fetch SOL balance: ${cleanMsg}`);
    }
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
    // Use the configured RPC URL or default
    const rpcUrl = getRpcUrl();
    const connection = new Connection(rpcUrl, {
        commitment: "confirmed",
        httpHeaders: {
            "User-Agent": "Nomin/1.0"
        }
    });
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

