<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  // Client-side failsafe redirect (works on browser and mobile)
  // Server-side redirect in hooks.server.ts should handle most cases,
  // but this ensures we never show an empty page
  onMount(() => {
    if (browser) {
      // Use window.location.replace for reliable cross-platform redirect
      // This works on both desktop browsers and mobile devices
      if (window.location.pathname === "/" || window.location.pathname === "") {
        window.location.replace("/store");
      }
    }
  });
</script>
