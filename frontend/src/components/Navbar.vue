<template>
  <nav class="navbar">
    <div class="nav-inner page-wrapper">
      <RouterLink to="/" class="brand">MyImages</RouterLink>

      <!-- Desktop nav -->
      <div class="nav-right desktop-nav">
        <div class="user-info">
          <img v-if="auth.user?.avatar" :src="auth.user.avatar" class="avatar" :alt="auth.user.name" />
          <span class="username">{{ auth.user?.name }}</span>
        </div>
        <RouterLink v-if="auth.user?.role === 'admin' || auth.user?.role === 'subadmin'" to="/admin" class="btn-ghost nav-btn">Admin</RouterLink>
        <button class="btn-ghost nav-btn" @click="showShare = true">Share</button>
        <button class="btn-icon theme-btn" @click="theme.toggle()" :title="theme.isDark ? 'Switch to light' : 'Switch to dark'">
          {{ theme.isDark ? '☀️' : '🌙' }}
        </button>
        <button class="btn-ghost nav-btn" @click="handleLogout">Sign out</button>
      </div>

      <!-- Mobile hamburger -->
      <div class="mobile-controls">
        <button class="btn-icon theme-btn" @click="theme.toggle()">{{ theme.isDark ? '☀️' : '🌙' }}</button>
        <button class="btn-icon hamburger" @click="menuOpen = !menuOpen">
          <span :class="['bar', { open: menuOpen }]"></span>
        </button>
      </div>
    </div>

    <!-- Mobile dropdown menu -->
    <div v-if="menuOpen" class="mobile-menu">
      <div class="mobile-user">
        <img v-if="auth.user?.avatar" :src="auth.user.avatar" class="avatar" :alt="auth.user.name" />
        <span>{{ auth.user?.name }}</span>
      </div>
      <RouterLink v-if="auth.user?.role === 'admin' || auth.user?.role === 'subadmin'" to="/admin" class="mobile-link" @click="menuOpen = false">Admin</RouterLink>
      <button class="mobile-link" @click="showShare = true; menuOpen = false">Share</button>
      <button class="mobile-link danger-link" @click="handleLogout">Sign out</button>
    </div>
  </nav>

  <ShareModal v-if="showShare" @close="showShare = false" />
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import ShareModal from './ShareModal.vue';

const auth = useAuthStore();
const theme = useThemeStore();
const router = useRouter();
const showShare = ref(false);
const menuOpen = ref(false);

const handleLogout = () => {
  auth.logout();
  router.push('/login');
};
</script>

<style scoped>
.navbar {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 200;
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
  color: var(--color-primary);
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.nav-btn { font-size: 0.8125rem; padding: 0.375rem 0.75rem; }

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: 0.25rem;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.username { font-size: 0.875rem; color: var(--color-muted); }

.theme-btn { font-size: 1rem; padding: 0.375rem 0.5rem; }

/* Mobile hamburger */
.mobile-controls { display: none; align-items: center; gap: 0.25rem; }

.hamburger {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 36px;
  height: 36px;
  gap: 5px;
  padding: 0;
}

.bar {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--color-text);
  border-radius: 2px;
  transition: all 0.2s;
}

.mobile-menu {
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.mobile-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  color: var(--color-muted);
  font-size: 0.875rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0.25rem;
}

.mobile-link {
  background: none;
  border: none;
  color: var(--color-text);
  text-align: left;
  padding: 0.625rem 0.5rem;
  font-size: 0.9375rem;
  border-radius: var(--radius);
  cursor: pointer;
}
.mobile-link:hover { background: var(--color-surface-2); }
.danger-link { color: var(--color-danger); }

@media (max-width: 640px) {
  .desktop-nav { display: none; }
  .mobile-controls { display: flex; }
}
</style>

