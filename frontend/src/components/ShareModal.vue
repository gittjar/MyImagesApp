<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>Share images</h3>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <div v-if="!created" class="modal-body">
          <div class="form-group">
            <label>Title (optional)</label>
            <input v-model="title" type="text" placeholder="E.g. Summer 2026" />
          </div>

          <div class="form-group">
            <label>PIN code (optional, 4–8 digits)</label>
            <input v-model="pin" type="text" inputmode="numeric" maxlength="8" placeholder="Leave empty for no PIN" />
          </div>

          <div class="form-group">
            <label>Expires in</label>
            <select v-model="expiresInDays">
              <option value="">Never</option>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          <p class="hint">This will share <strong>all your images</strong>. The recipient visits the link and enters the PIN (if set).</p>
          <p v-if="error" class="error-msg">{{ error }}</p>

          <div class="modal-actions">
            <button class="btn-ghost" @click="emit('close')">Cancel</button>
            <button class="btn-primary" :disabled="loading" @click="create">
              {{ loading ? 'Creating…' : 'Create share link' }}
            </button>
          </div>
        </div>

        <div v-else class="modal-body success">
          <div class="success-icon">✅</div>
          <p class="success-label">Share link created!</p>
          <div class="link-row">
            <input :value="shareUrl" readonly class="link-input" />
            <button class="btn-primary btn-copy" @click="copy">{{ copied ? 'Copied!' : 'Copy' }}</button>
          </div>
          <p v-if="hasPin" class="pin-note">PIN: <strong>{{ pin }}</strong> — send this separately to the recipient.</p>
          <p v-if="expiresAt" class="expiry-note">Expires: {{ formatDate(expiresAt) }}</p>
          <div class="modal-actions">
            <button class="btn-ghost" @click="emit('close')">Close</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';
import api from '../services/api';

const emit = defineEmits(['close']);

const title = ref('');
const pin = ref('');
const expiresInDays = ref('');
const loading = ref(false);
const error = ref('');
const created = ref(false);
const copied = ref(false);
const shareUrl = ref('');
const hasPin = ref(false);
const expiresAt = ref(null);

const create = async () => {
  if (pin.value && !/^\d{4,8}$/.test(pin.value)) {
    error.value = 'PIN must be 4–8 digits.';
    return;
  }
  error.value = '';
  loading.value = true;
  try {
    const payload = { title: title.value };
    if (pin.value) payload.pin = pin.value;
    if (expiresInDays.value) payload.expiresInDays = expiresInDays.value;

    const { data } = await api.post('/share', payload);
    shareUrl.value = data.url;
    hasPin.value = data.hasPin;
    expiresAt.value = data.expiresAt;
    created.value = true;
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to create share link.';
  } finally {
    loading.value = false;
  }
};

const copy = async () => {
  await navigator.clipboard.writeText(shareUrl.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-FI', { day: 'numeric', month: 'long', year: 'numeric' });
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  padding: 1rem;
}

.modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  width: 100%;
  max-width: 440px;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 { font-size: 1.125rem; }

.close-btn {
  background: transparent;
  color: var(--color-muted);
  font-size: 1rem;
  padding: 0.25rem;
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hint {
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.success { align-items: center; text-align: center; }

.success-icon { font-size: 2.5rem; }

.success-label { font-size: 1.05rem; font-weight: 600; }

.link-row {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

.link-input {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--color-text);
  background: var(--color-surface-2);
}

.btn-copy {
  white-space: nowrap;
  padding: 0.5rem 0.875rem;
}

.pin-note {
  font-size: 0.875rem;
  color: var(--color-danger);
}

.expiry-note {
  font-size: 0.8125rem;
  color: var(--color-muted);
}
</style>
