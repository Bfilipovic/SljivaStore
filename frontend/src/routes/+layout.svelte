<script lang="ts">
  import Nav from '$lib/Nav.svelte';
  import Footer from '$lib/Footer.svelte';
  import '../app.css'; // << this is critical
  import "$lib/polyfills";
</script>

<div class="min-h-screen flex flex-col">
  <Nav />
  
  <main class="flex-1">
    <slot />
  </main>
  
  <Footer />
</div>
