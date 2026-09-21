<script setup lang="ts">
import type { Status } from "@gameshelf/core";
import { STATUS_META } from "../status";

defineProps<{ status: Status }>();
</script>

<template>
  <span
    :class="[
      'rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 backdrop-blur',
      STATUS_META[status].badge,
    ]"
  >
    {{ STATUS_META[status].label }}
  </span>
</template>
