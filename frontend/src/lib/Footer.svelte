<script lang="ts">
  import TermsOfServiceModal from './TermsOfServiceModal.svelte';
  import FAQModal from './FAQModal.svelte';

  let showTosModal = false;
  let showFaqModal = false;
  
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

  // FAQ text
  const faqText = `KEY CONCEPTS

What are NFT Parts?
NFT Parts are fractionalized portions of NFTs (Non-Fungible Tokens) that represent Real-World Assets (RWA). Each NFT can be divided into multiple parts, allowing multiple users to own different parts of the same NFT. This enables fractional ownership and trading of assets.

How does authentication work?
The platform uses 12-word mnemonic phrases for authentication. When you first log in, you'll enter your 12-word mnemonic phrase. After that, you'll set a session password that you'll use for the rest of your session. Your mnemonic phrase is encrypted and stored locally in your browser - it never leaves your device or is transmitted to any servers.

What is YRT?
YRT is a Clearing Token used on the platform. All prices are displayed in YRT, which is automatically converted to ETH or SOL at the time of transaction. The value of one YRT is based on a weighted basket of five major currencies. YRT is designed to facilitate transactions directly on the blockchain.

What currencies are supported?
The platform supports two cryptocurrencies: Ethereum (ETH) and Solana (SOL). You can select your preferred currency using the dropdown in the navigation bar. All transactions are processed using the selected currency.

SITE USAGE

How do I buy NFT Parts?
1. Browse the store to find NFT parts you want to purchase
2. Click on a listing to view details
3. Click "Buy" and enter your session password to reserve the parts
4. You have 60 seconds to complete the purchase
5. Confirm the transaction to complete your purchase

What is the reservation system?
When you click "Buy" on a listing, the parts are reserved for you for 60 seconds. During this time, the listing shows as "Reserved" and other users cannot purchase those parts. You must complete the purchase within 60 seconds, or the reservation expires and the parts become available again.

How do I sell my NFT Parts?
1. Go to "MY NFTS" to see your owned parts
2. Select an NFT and click "Create Listing"
3. Choose whether you want a bundle sale (buyer must purchase all listed parts together) or individual sale
4. Enter the quantity you want to sell and the price in YRT
5. Confirm with your session password
6. Your listing will appear in the store

How do I manage my listings?
Go to "MY NFTS" and click on any NFT where you have active listings. From there, you can view and delete your listings as needed.

What are Gifts?
Gifts allow you to send NFT parts to another user's address. You can create a gift from the NFT details page. The recipient can then accept or refuse the gift from their "Gifts" page.

What is Nomin Explorer?
Nomin Explorer is a service for browsing and verifying transactions on the blockchain. You can use it to track the history of NFT parts and verify transaction details. You can access it from the footer link.

How do I view my owned parts?
Navigate to "MY NFTS" in the main navigation. Here you'll see all NFTs where you own parts, along with how many parts you own and how many are available for sale.

What happens if my session expires?
Your session password expires after 30 minutes of inactivity or when you close your browser tab. When your session expires, you'll be logged out automatically and will need to log in again with your 12-word mnemonic phrase.

SECURITY

Is my mnemonic phrase secure?
Yes. Your 12-word mnemonic phrase is encrypted using the Web Crypto API and stored only in your browser's sessionStorage. It never leaves your device or is transmitted to any third-party servers. Only you have access to it.

What should I do if I lose my mnemonic phrase?
If you lose your mnemonic phrase, you will lose access to your wallet and NFT parts. The platform cannot recover your mnemonic phrase as it never stores it. Always keep your mnemonic phrase safe and secure.`;

  function openTos() {
    showTosModal = true;
  }

  function openFaq() {
    showFaqModal = true;
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
      <button
        on:click={openFaq}
        class="text-gray-400 hover:text-white underline transition-colors"
      >
        FAQ
      </button>
      <span class="text-gray-600">|</span>
      <a
        href="https://nomin.space/"
        target="_blank"
        rel="noopener noreferrer"
        class="text-gray-400 hover:text-white underline transition-colors"
      >
        Nomin Explorer
      </a>
    </div>
  </div>
</footer>

<TermsOfServiceModal bind:visible={showTosModal} {tosText} />
<FAQModal bind:visible={showFaqModal} faqText={faqText} />

