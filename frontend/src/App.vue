<template>
  <RouterView />
  <ConfirmModal />
</template>

<script setup>
import { useThemeStore } from './stores/theme';
import ConfirmModal from './components/ConfirmModal.vue';
// Initialize theme on app mount (store constructor already applies it,
// but importing here ensures it runs before first render)
useThemeStore();
</script>
