<template>
  <div class="auth-page">
    <!-- Background blobs -->
    <div class="bg-blob blob-1" aria-hidden="true"></div>
    <div class="bg-blob blob-2" aria-hidden="true"></div>

    <div class="auth-card">
      <!-- Logo -->
      <div class="auth-logo">
        <div class="logo-icon"><Images :size="26" /></div>
        <span class="logo-text">MyImages</span>
      </div>
      <p class="auth-tagline">{{ t('login.tagline') }}</p>

      <!-- Google -->
      <button class="btn-google" @click="auth.loginWithGoogle()">
        <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
          <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
          <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.002 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
          <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
          <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
        </svg>
        {{ t('login.continueWithGoogle') }}
      </button>

      <div class="divider"><span>{{ t('login.or') }}</span></div>

      <!-- Tabs -->
      <div class="tabs" role="tablist">
        <button role="tab" :aria-selected="mode === 'login'" :class="['tab', { active: mode === 'login' }]" @click="switchMode('login')">{{ t('login.signIn') }}</button>
        <button role="tab" :aria-selected="mode === 'register'" :class="['tab', { active: mode === 'register' }]" @click="switchMode('register')">{{ t('login.register') }}</button>
      </div>

      <form @submit.prevent="submit" novalidate>
        <!-- REGISTER ONLY fields -->
        <template v-if="mode === 'register'">
          <div class="field">
            <label class="field-label">{{ t('login.nameLabel') }} <span class="required">*</span></label>
            <div class="input-wrap">
              <User2 class="field-icon" :size="15" />
              <input v-model="form.name" type="text" :placeholder="t('login.namePlaceholder')" autocomplete="name" required />
            </div>
          </div>

          <div class="field">
            <label class="field-label">{{ t('login.emailLabel') }} <span class="required">*</span></label>
            <div class="input-wrap">
              <Mail class="field-icon" :size="15" />
              <input v-model="form.email" type="email" placeholder="you@example.com" autocomplete="email" required />
            </div>
          </div>

          <div class="field">
            <label class="field-label">
              {{ t('login.usernameLabel') }}
              <span class="optional">{{ t('login.optional') }}</span>
            </label>
            <div class="input-wrap">
              <AtSign class="field-icon" :size="15" />
              <input v-model="form.username" type="text" :placeholder="t('login.usernamePlaceholder')" autocomplete="username" />
            </div>
            <p class="field-hint">{{ t('login.usernameHint') }}</p>
          </div>
        </template>

        <!-- LOGIN ONLY: identifier -->
        <template v-else>
          <div class="field">
            <label class="field-label">{{ t('login.identifierLabel') }}</label>
            <div class="input-wrap">
              <Mail class="field-icon" :size="15" />
              <input v-model="form.identifier" type="text" :placeholder="t('login.identifierPlaceholder')" autocomplete="username email" required />
            </div>
          </div>
        </template>

        <!-- Password -->
        <div class="field">
          <label class="field-label">{{ t('login.passwordLabel') }} <span class="required">*</span></label>
          <div class="input-wrap">
            <Lock class="field-icon" :size="15" />
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              :placeholder="mode === 'register' ? t('login.passwordPlaceholderRegister') : '••••••••'"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              required
            />
            <button type="button" class="eye-btn" @click="showPassword = !showPassword" :aria-label="showPassword ? 'Hide' : 'Show'">
              <Eye v-if="!showPassword" :size="14" />
              <EyeOff v-else :size="14" />
            </button>
          </div>

          <!-- Strength indicator (register only) -->
          <template v-if="mode === 'register' && form.password">
            <div class="strength-bar">
              <div v-for="i in 4" :key="i" class="strength-segment" :class="strengthClass(i)"></div>
            </div>
            <ul class="pw-rules">
              <li :class="{ met: form.password.length >= 8 }"><Check v-if="form.password.length >= 8" :size="11" /><X2 v-else :size="11" /> {{ t('login.ruleLength') }}</li>
              <li :class="{ met: /[A-Z]/.test(form.password) }"><Check v-if="/[A-Z]/.test(form.password)" :size="11" /><X2 v-else :size="11" /> {{ t('login.ruleUpper') }}</li>
              <li :class="{ met: /[0-9]/.test(form.password) }"><Check v-if="/[0-9]/.test(form.password)" :size="11" /><X2 v-else :size="11" /> {{ t('login.ruleNumber') }}</li>
              <li :class="{ met: /[^A-Za-z0-9]/.test(form.password) }"><Check v-if="/[^A-Za-z0-9]/.test(form.password)" :size="11" /><X2 v-else :size="11" /> {{ t('login.ruleSpecial') }}</li>
            </ul>
          </template>
        </div>

        <p v-if="error" class="error-banner">{{ error }}</p>

        <button type="submit" class="btn-submit" :disabled="loading || (mode === 'register' && !passwordValid)">
          <span v-if="!loading">{{ mode === 'login' ? t('login.signIn') : t('login.createAccount') }}</span>
          <span v-else class="spinner"></span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { Images, Mail, Lock, Eye, EyeOff, User2, AtSign, Check, X as X2 } from 'lucide-vue-next';

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();

const mode = ref('login');
const loading = ref(false);
const error = ref('');
const showPassword = ref(false);
const form = reactive({ name: '', email: '', username: '', identifier: '', password: '' });

const switchMode = (m) => {
  mode.value = m;
  error.value = '';
  showPassword.value = false;
};

const passwordValid = computed(() =>
  form.password.length >= 8 &&
  /[A-Z]/.test(form.password) &&
  /[0-9]/.test(form.password) &&
  /[^A-Za-z0-9]/.test(form.password)
);

const passwordScore = computed(() => {
  let score = 0;
  if (form.password.length >= 8) score++;
  if (/[A-Z]/.test(form.password)) score++;
  if (/[0-9]/.test(form.password)) score++;
  if (/[^A-Za-z0-9]/.test(form.password)) score++;
  return score;
});

const strengthClass = (i) => {
  if (passwordScore.value === 0) return '';
  if (i > passwordScore.value) return '';
  if (passwordScore.value <= 1) return 'weak';
  if (passwordScore.value <= 2) return 'fair';
  if (passwordScore.value <= 3) return 'good';
  return 'strong';
};

const submit = async () => {
  error.value = '';
  loading.value = true;
  try {
    if (mode.value === 'login') {
      await auth.login(form.identifier, form.password);
    } else {
      await auth.register(form.name, form.email, form.password, form.username || undefined);
    }
    router.push('/');
  } catch (err) {
    error.value = err.response?.data?.message || t('login.errorGeneric');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.auth-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--color-bg);
  position: relative;
  overflow: hidden;
}

/* Decorative blobs */
.bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.25;
  pointer-events: none;
}
.blob-1 {
  width: 480px;
  height: 480px;
  background: radial-gradient(circle, #818cf8, #4f46e5);
  top: -120px;
  left: -80px;
}
.blob-2 {
  width: 380px;
  height: 380px;
  background: radial-gradient(circle, #7c3aed, #4338ca);
  bottom: -100px;
  right: -60px;
}

/* Card */
.auth-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 2.25rem 2rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
  position: relative;
  z-index: 1;
}

/* Logo */
.auth-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
}
.logo-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.auth-tagline {
  text-align: center;
  color: var(--color-muted);
  font-size: 0.875rem;
  margin-top: -0.375rem;
}

/* Google btn */
.btn-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.65rem 1rem;
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-2);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text);
  transition: background 0.2s, border-color 0.2s;
}
.btn-google:hover { background: var(--color-border); }

/* Divider */
.divider {
  text-align: center;
  position: relative;
  color: var(--color-muted);
  font-size: 0.75rem;
}
.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 44%;
  height: 1px;
  background: var(--color-border);
}
.divider::before { left: 0; }
.divider::after  { right: 0; }

/* Tabs */
.tabs {
  display: flex;
  background: var(--color-surface-2);
  border-radius: 10px;
  padding: 3px;
  gap: 3px;
}
.tab {
  flex: 1;
  padding: 0.45rem;
  background: transparent;
  border-radius: 8px;
  color: var(--color-muted);
  border: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.2s, color 0.2s;
}
.tab.active {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
}

/* Form */
form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.required { color: var(--color-danger); }
.optional { font-size: 0.725rem; color: var(--color-muted); font-weight: 400; }

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.field-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--color-muted);
  pointer-events: none;
  flex-shrink: 0;
}
.input-wrap input {
  padding-left: 2.25rem;
  padding-right: 0.75rem;
  padding-top: 0.55rem;
  padding-bottom: 0.55rem;
  border-radius: 9px;
  font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input-wrap input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);
  outline: none;
}

.eye-btn {
  position: absolute;
  right: 0.625rem;
  background: transparent;
  border: none;
  padding: 0.25rem;
  color: var(--color-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  line-height: 1;
}
.eye-btn:hover { color: var(--color-text); }

.field-hint {
  font-size: 0.7rem;
  color: var(--color-muted);
}

/* Password strength */
.strength-bar {
  display: flex;
  gap: 4px;
  margin-top: 0.25rem;
}
.strength-segment {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--color-border);
  transition: background 0.3s;
}
.strength-segment.weak  { background: #ef4444; }
.strength-segment.fair  { background: #f97316; }
.strength-segment.good  { background: #eab308; }
.strength-segment.strong { background: #22c55e; }

.pw-rules {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.25rem;
}
.pw-rules li {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7125rem;
  color: var(--color-muted);
  transition: color 0.2s;
}
.pw-rules li.met { color: #22c55e; }

/* Error banner */
.error-banner {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
  color: var(--color-danger);
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
  font-size: 0.8125rem;
  line-height: 1.4;
}

/* Submit button */
.btn-submit {
  width: 100%;
  padding: 0.675rem 1rem;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
}
.btn-submit:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 480px) {
  .auth-card { padding: 1.75rem 1.25rem; border-radius: 16px; }
}
</style>
