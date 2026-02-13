<script lang="ts">
  // Generic item card component with slots for flexible content
  // Used across transactions, gifts, listings, uploads pages
</script>

<div class="border border-gray-300 p-4 bg-white shadow-sm hover:shadow-md transition">
  <div class="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
    <!-- Image slot -->
    <slot name="image">
      <!-- Default fallback if no image slot provided -->
      <div class="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 flex items-center justify-center flex-shrink-0">
        <span class="text-gray-400 text-xs">No image</span>
      </div>
    </slot>

    <!-- Info section -->
    <div class="flex-grow min-w-0 w-full sm:w-auto text-center sm:text-left flex flex-col items-center sm:items-start">
      <!-- Title slot (optional) -->
      <slot name="title"></slot>
      
      <!-- Info/details slot -->
      <slot name="info"></slot>
    </div>

    <!-- Actions slot -->
    <div class="flex items-center justify-center sm:items-start sm:justify-start w-full sm:w-auto">
      <slot name="actions"></slot>
    </div>
  </div>
</div>

