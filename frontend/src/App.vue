<template>
  <RouterView />
</template>

<script setup>
import { useThemeStore } from './stores/theme';
// Initialize theme on app mount (store constructor already applies it,
// but importing here ensures it runs before first render)
useThemeStore();
</script>
