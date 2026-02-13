<script lang="ts">
  export let profileData: any;
  export let titleLevel: 'h1' | 'h2' = 'h2'; // Allow customization of heading level
</script>

{#if profileData}
  <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
    {#if titleLevel === 'h1'}
      <h1 class="text-2xl font-semibold mb-4">{profileData.username || 'Photographer'}</h1>
    {:else}
      <h2 class="text-xl font-semibold mb-4">{profileData.username || 'Photographer'}</h2>
    {/if}
    
    <div class="space-y-4">
      {#if profileData.fullName}
        <div>
          <span class="font-medium text-gray-700">Full Name:</span>
          <span class="ml-2 text-gray-900">{profileData.fullName}</span>
        </div>
      {/if}
      
      {#if profileData.country || profileData.city}
        <div>
          <span class="font-medium text-gray-700">Location:</span>
          <span class="ml-2 text-gray-900">
            {[profileData.city, profileData.country].filter(Boolean).join(', ') || 'N/A'}
          </span>
        </div>
      {/if}
      
      {#if profileData.email}
        <div>
          <span class="font-medium text-gray-700">Email:</span>
          <span class="ml-2 text-gray-900">{profileData.email}</span>
        </div>
      {/if}
      
      {#if profileData.biography}
        <div>
          <span class="font-medium text-gray-700">Biography:</span>
          <p class="mt-1 text-gray-900 whitespace-pre-wrap">{profileData.biography}</p>
        </div>
      {/if}
    </div>
  </div>
{/if}

