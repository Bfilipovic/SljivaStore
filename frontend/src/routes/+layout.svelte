<script lang="ts">
  import Nav from '$lib/Nav.svelte';
  import '../app.css'; // << this is critical
  import "$lib/polyfills";
</script>

<Nav />

<slot />
