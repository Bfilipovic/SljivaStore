<script lang="ts">
  import TermsOfServiceModal from './TermsOfServiceModal.svelte';

  let showTosModal = false;
  
  // Terms of Service text - loaded from static file
  const tosText = `NFTs are the evidence of physical asset in the digital world that can be bought and sold like any other piece of property, issued via Blockchain.
The Platform is built on top of the Ethereum network and users can only buy and sell Collectibles using the cryptocurrency Ether ("ETH"). No fiat money is stored or handled by the Platform at any point.
"NFTs" means the tokens with string constant public presence, which are tracked by the Txn Hash, deployed to the Ethereum Blockchain.
Peer-to-peer transactions, allow you freely trade your assets by NFTs, without a bank or financial institution intermediary.
NFTs are intended to be "non-fungible" tokens representing a unique Collectible. 
Users are responsible for all matters relating to their accounts on the NFTs Apps or the ETH blockchain accounts or addresses through which they interact with the Offerings.
Users are responsible for protecting the confidentiality of their login information for the NFTs Apps or the private keys controlling the relevant blockchain accounts or addresses through which they interact with the Offerings.
All content on the NFTs Platform belongs to Users. What's yours is yours — you own your Content
The NFTs Platform are being provided on an "AS IS" and "AS AVAILABLE" basis.
NFTs Platform shall not be liable for any errors, misrepresentations, or omissions in, of, and about, the content, nor for the availability of the content. NFTs Platform shall not be liable for any losses, injuries, or damages from the purchase, inability to purchase, display, or use of content.
Users must not, create, buy, sell or use any Collectible that infringes or in a manner infringing the copyright, trademark, patent, trade secret or other intellectual property or other proprietary rights of others, or upload, or otherwise make available, files that contain images, photographs, or other material protected by intellectual property laws or rights of privacy or publicity unless the applicable User owns or controls the rights thereto or has received all necessary consent to do the same.
User acknowledges and agrees that use of the Offerings is at the User's own risk and on own initiative and are responsible for compliance with local laws.
Before Users make any decisions involving the Offerings, Users should seek independent professional advice from persons licensed and qualified in the area for which such advice would be appropriate.`;

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
        href="https://nft.nomin.foundation/"
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

