<template>
  <div class="callback-page">
    <p v-if="error" class="error-msg">{{ error }}</p>
    <p v-else>Signing in…</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const error = ref('');

onMounted(async () => {
  const token = route.query.token;
  const err = route.query.error;

  if (err || !token) {
    error.value = 'Google sign-in failed. Please try again.';
    setTimeout(() => router.push('/login'), 2500);
    return;
  }

  localStorage.setItem('token', token);
  auth.token = token;
  await auth.fetchMe();

  if (auth.isAuthenticated) {
    router.push('/');
  } else {
    error.value = 'Authentication failed.';
    setTimeout(() => router.push('/login'), 2500);
  }
});
</script>

<style scoped>
.callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  color: #6b7280;
}
</style>
