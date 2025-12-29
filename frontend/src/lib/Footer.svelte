<script lang="ts">
  import TermsOfServiceModal from './TermsOfServiceModal.svelte';

  let showTosModal = false;
  
  // Terms of Service text - loaded from static file
  const tosText = `NFTs are the evidence of the Real-world asset (RWA) in the digital world that can be bought and sold like any other piece of property, issued via Blockchain.

The Platform is built on top of the Blockchain network and users can buy and sell NFT parts using the crypto currencies, only, Ether (ETH) or Solana (SOL). 
No fiat money is stored or handled by the Platform at any point.

The prices are displayed in YRT (a platform token, only) is converted to ETH or SOL at the time of transaction. The value of one YRT is based on a weighted basket of five major currencies.
YRT is a Clearing Token that designed to "replace" the fiat currency and stable coins on the Blockchain. 
YRT is intended to facilitate transactions (clearing) directly on the blockchain.

NFTs are divided into parts that can be individually owned and traded
"NFT Parts" means fractionalized portions of NFTs, each tracked by unique identifiers and transaction hashes, deployed to the Ethereum and Solana blockchains, allowing multiple users to own different parts of the same NFT.
Platform tracks individual parts of NFTs.

Peer-to-peer transactions, allow you freely trade assets by your "NFT Parts", without a bank or financial institution intermediary.

Platform uses 12-word mnemonic phrases as a basic and only standard for Blockchain authentication.
Users are responsible for protecting the confidentiality of their login information and private keys (12-word mnemonic phrases) that control their blockchain accounts or addresses through which they interact with the Platform. 
IMPORTANT: Your mnemonic phrase is encrypted and stored locally in your browser, it never leaves your device or transmitted to any third part servers.

All NFT parts you own on the Platform belong to you. What's yours is yours — you own your NFT parts.
The NFTs Platform are being provided on an "AS IS" and "AS AVAILABLE" basis.

NFTs Platform shall not be liable for any errors, misrepresentations, or omissions in, of, and about, the content, nor for the availability of the content. NFTs Platform shall not be liable for any losses, injuries, or damages from the purchase, inability to purchase, display, or use of content.
All transactions are permanently stored on Arweave Blockchain for verification and audit purposes.

Users must not create, buy, sell, gift, or use any NFT part or Collectible that infringes or in a manner infringing the copyright, trademark, patent, trade secret or other intellectual property or other proprietary rights of others, or upload, or otherwise make available, files that contain images, photographs, or other material protected by intellectual property laws or rights of privacy or publicity unless the applicable User owns or controls the rights thereto or has received all necessary consent to do the same.
User acknowledges and agrees that use of the Offerings is at the User's own risk and on own initiative and are responsible for compliance with local laws.
Before Users make any decisions involving the Offerings, Users should seek independent professional advice from persons licensed and qualified in the area for which such advice would be appropriate.

"Nomin Explorer" is a service for browsing and verifying transactions.`;

  function openTos() {
    showTosModal = true;
  }
</script>

<footer class="bg-gray-900 text-white py-4 mt-auto">
  <div class="max-w-4xl mx-auto px-4 text-center text-sm">
    <div class="flex justify-center items-center gap-4">
      <button
        on:click={openTos}
        class="text-gray-400 hover:text-white underline transition-colors"
      >
        Terms of Service
      </button>
      <span class="text-gray-600">|</span>
      <a
        href="https://nomin.space/"
        target="_blank"
        rel="noopener noreferrer"
        class="text-gray-400 hover:text-white underline transition-colors"
      >
        Visit the official Nomin network Explorer
      </a>
    </div>
  </div>
</footer>

<TermsOfServiceModal bind:visible={showTosModal} {tosText} />

