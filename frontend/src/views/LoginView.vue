<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="logo">MyImages</h1>
      <p class="tagline">Your personal image library</p>

      <!-- Google login -->
      <button class="btn-google" @click="auth.loginWithGoogle()">
        <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
          <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.002 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
          <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
          <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
        </svg>
        Continue with Google
      </button>

      <div class="divider"><span>or</span></div>

      <!-- Local auth tabs -->
      <div class="tabs">
        <button :class="['tab', { active: mode === 'login' }]" @click="mode = 'login'">Sign in</button>
        <button :class="['tab', { active: mode === 'register' }]" @click="mode = 'register'">Register</button>
      </div>

      <form @submit.prevent="submit">
        <div v-if="mode === 'register'" class="form-group">
          <label>Name</label>
          <input v-model="form.name" type="text" placeholder="Your name" required />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input v-model="form.email" type="email" placeholder="you@example.com" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input v-model="form.password" type="password" placeholder="••••••••" required />
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button type="submit" class="btn-primary btn-full" :disabled="loading">
          {{ loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

const mode = ref('login');
const loading = ref(false);
const error = ref('');
const form = reactive({ name: '', email: '', password: '' });

const submit = async () => {
  error.value = '';
  loading.value = true;
  try {
    if (mode.value === 'login') {
      await auth.login(form.email, form.password);
    } else {
      await auth.register(form.name, form.email, form.password);
    }
    router.push('/');
  } catch (err) {
    error.value = err.response?.data?.message || 'Something went wrong';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1.5rem;
}

.login-card {
  background: #fff;
  border-radius: 16px;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.logo {
  font-size: 1.75rem;
  font-weight: 700;
  text-align: center;
  color: #4f46e5;
}

.tagline {
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
  margin-top: -0.5rem;
}

.btn-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.625rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  color: #374151;
  transition: background 0.2s;
}

.btn-google:hover {
  background: #f9fafb;
}

.divider {
  text-align: center;
  position: relative;
  color: #9ca3af;
  font-size: 0.8125rem;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 42%;
  height: 1px;
  background: #e5e7eb;
}

.divider::before { left: 0; }
.divider::after { right: 0; }

.tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
}

.tab {
  flex: 1;
  padding: 0.5rem;
  background: transparent;
  border-radius: 0;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  font-size: 0.875rem;
}

.tab.active {
  color: #4f46e5;
  border-bottom-color: #4f46e5;
}

form {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.btn-full {
  width: 100%;
  padding: 0.625rem;
  font-size: 0.9rem;
}
</style>
