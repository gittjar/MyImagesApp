<template>
  <nav class="navbar">
    <div class="page-wrapper nav-inner">
      <RouterLink to="/" class="brand">MyImages</RouterLink>

      <div class="nav-right">
        <div class="user-info">
          <img v-if="auth.user?.avatar" :src="auth.user.avatar" class="avatar" :alt="auth.user.name" />
          <span class="username">{{ auth.user?.name }}</span>
        </div>
        <button class="btn-ghost" @click="showShare = true">Share</button>
        <button class="btn-ghost" @click="handleLogout">Sign out</button>
      </div>
    </div>
  </nav>

  <ShareModal v-if="showShare" @close="showShare = false" />
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import ShareModal from './ShareModal.vue';

const auth = useAuthStore();
const router = useRouter();
const showShare = ref(false);

const handleLogout = () => {
  auth.logout();
  router.push('/login');
};
</script>

<style scoped>
.navbar {
  background: #fff;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}

.brand {
  font-size: 1.125rem;
  font-weight: 700;
  color: #4f46e5;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
}

.username {
  font-size: 0.875rem;
  color: #374151;
}
</style>
