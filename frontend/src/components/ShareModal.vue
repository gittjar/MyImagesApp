<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>Share</h3>
          <button class="btn-icon close-btn" @click="emit('close')">✕</button>
        </div>

        <!-- Create form -->
        <div v-if="!created" class="modal-body">
          <!-- Scope selector -->
          <div class="scope-tabs">
            <button
              v-for="s in scopeOptions"
              :key="s.value"
              :class="['scope-tab', scope === s.value ? 'active' : '']"
              @click="setScope(s.value)"
            >
              <span class="scope-icon">{{ s.icon }}</span>
              <span>{{ s.label }}</span>
            </button>
          </div>
          <p class="scope-desc">{{ currentScopeDesc }}</p>

          <!-- Folder picker -->
          <div v-if="scope === 'folder'" class="form-group">
            <label>Choose folder</label>
            <select v-model="selectedFolder">
              <option value="" disabled>— select a folder —</option>
              <option v-for="f in folders" :key="f._id" :value="f._id">📁 {{ f.name }}</option>
            </select>
            <p v-if="scope === 'folder' && !selectedFolder" class="hint">Select a folder above.</p>
          </div>

          <!-- Image preview for single image share -->
          <div v-if="scope === 'selection' && initialImageIds.length === 1" class="single-preview">
            <img v-if="previewItem?.mediaType !== 'video'" :src="previewItem?.url" alt="" />
            <video v-else :src="previewItem?.url" preload="metadata" muted />
            <span class="preview-name">{{ previewItem?.originalName }}</span>
          </div>
          <p v-else-if="scope === 'selection'" class="hint">
            {{ initialImageIds.length }} item(s) selected.
          </p>

          <div class="form-group">
            <label>Title <small>(optional)</small></label>
            <input v-model="title" type="text" placeholder="E.g. Summer 2026" @input="onTitleInput" />
          </div>

          <div class="form-group">
            <label>Link name <small>(required)</small></label>
            <input
              v-model="slug"
              type="text"
              placeholder="summer-2026"
              @input="slugManuallyEdited = true"
              spellcheck="false"
            />
            <p class="url-preview">{{ urlPreview }}</p>
          </div>

          <div class="form-group">
            <label>PIN code <small>(optional, 4–8 digits)</small></label>
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

          <p v-if="error" class="error-msg">{{ error }}</p>

          <div class="modal-actions">
            <button class="btn-ghost" @click="emit('close')">Cancel</button>
            <button class="btn-primary" :disabled="loading || !slug.trim() || (scope === 'folder' && !selectedFolder)" @click="create">
              {{ loading ? 'Creating…' : 'Create share link' }}
            </button>
          </div>
        </div>

        <!-- Success state -->
        <div v-else class="modal-body success">
          <div class="success-icon">✅</div>
          <p class="success-label">Share link created!</p>
          <div class="link-row">
            <input :value="shareUrl" readonly class="link-input" />
            <button class="btn-primary btn-copy" @click="copy">{{ copied ? 'Copied!' : 'Copy' }}</button>
          </div>
          <p v-if="hasPin" class="pin-note">PIN: <strong>{{ pin }}</strong> — share this separately.</p>
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
import { ref, computed } from 'vue';
import { useFolderStore } from '../stores/folders';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

const props = defineProps({
  initialScope: { type: String, default: 'all' },         // 'all' | 'folder' | 'selection'
  initialFolder: { type: String, default: null },          // folder _id
  initialImageIds: { type: Array, default: () => [] },     // image _ids for selection
  previewItem: { type: Object, default: null }             // single image object for preview
});
const emit = defineEmits(['close']);

const folderStore = useFolderStore();
const authStore = useAuthStore();
const folders = computed(() => folderStore.folders);

const scopeOptions = [
  { value: 'all',       label: 'All media',  icon: '📷' },
  { value: 'folder',    label: 'Folder',     icon: '📁' },
  { value: 'selection', label: 'This item',  icon: '🖼' }
];

const scopeDescs = {
  all:       'Share a link to all your media. Recipient sees everything you own.',
  folder:    'Share a single folder. Only images in that folder are visible.',
  selection: 'Share one specific image or video. Only this item is visible.'
};

const scope = ref(props.initialScope);
const selectedFolder = ref(props.initialFolder || '');
const title = ref('');
const slug = ref('');
const slugManuallyEdited = ref(false);
const pin = ref('');
const expiresInDays = ref('');
const loading = ref(false);
const error = ref('');

const slugify = (str) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]+/g, '').replace(/^-+|-+$/g, '').slice(0, 60);

const onTitleInput = () => {
  if (!slugManuallyEdited.value) {
    slug.value = slugify(title.value);
  }
};

const urlPreview = computed(() => {
  const base = window.location.origin;
  const userId = authStore.user?._id || '…';
  const s = slug.value || '…';
  return `${base}/share/${userId}/${s}`;
});
const created = ref(false);
const copied = ref(false);
const shareUrl = ref('');
const hasPin = ref(false);
const expiresAt = ref(null);

const currentScopeDesc = computed(() => scopeDescs[scope.value]);

const setScope = (s) => {
  // Don't allow changing away from selection if we were passed image IDs
  if (scope.value === 'selection' && props.initialImageIds.length > 0 && s !== 'selection') return;
  scope.value = s;
};

const create = async () => {
  if (!slug.value.trim()) {
    error.value = 'Link name is required.';
    return;
  }
  if (!/^[a-z0-9_-]+$/i.test(slug.value)) {
    error.value = 'Link name may only contain letters, numbers, hyphens and underscores.';
    return;
  }
  if (pin.value && !/^\d{4,8}$/.test(pin.value)) {
    error.value = 'PIN must be 4–8 digits.';
    return;
  }
  if (scope.value === 'folder' && !selectedFolder.value) {
    error.value = 'Please choose a folder.';
    return;
  }
  error.value = '';
  loading.value = true;
  try {
    const payload = { slug: slug.value.toLowerCase(), title: title.value, scope: scope.value };
    if (pin.value) payload.pin = pin.value;
    if (expiresInDays.value) payload.expiresInDays = expiresInDays.value;
    if (scope.value === 'folder') payload.folderId = selectedFolder.value;
    if (scope.value === 'selection') payload.imageIds = props.initialImageIds;

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
  background: rgba(0, 0, 0, 0.6);
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
  max-height: 90dvh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.125rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  background: var(--color-surface);
  z-index: 1;
}
.modal-header h3 { font-size: 1.0625rem; font-weight: 600; }
.close-btn { color: var(--color-muted); font-size: 0.9rem; padding: 0.25rem 0.5rem; }

.modal-body {
  padding: 1.25rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Scope tabs ── */
.scope-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.scope-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.625rem 0.5rem;
  background: var(--color-surface-2);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-muted);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s;
}
.scope-tab .scope-icon { font-size: 1.25rem; }
.scope-tab.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}
.scope-tab:hover:not(.active) { background: var(--color-border); color: var(--color-text); }

.scope-desc {
  font-size: 0.8125rem;
  color: var(--color-muted);
  margin-top: -0.25rem;
}

/* Single image preview */
.single-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--color-surface-2);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  overflow: hidden;
}
.single-preview img,
.single-preview video {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 5px;
  flex-shrink: 0;
}
.preview-name {
  font-size: 0.8125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
}

.hint {
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.url-preview {
  font-size: 0.75rem;
  color: var(--color-muted);
  margin-top: 0.35rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  opacity: 0.8;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.success { align-items: center; text-align: center; }
.success-icon { font-size: 2.5rem; }
.success-label { font-size: 1.05rem; font-weight: 600; }

.link-row { display: flex; gap: 0.5rem; width: 100%; }
.link-input { flex: 1; font-size: 0.8125rem; color: var(--color-text); background: var(--color-surface-2); }
.btn-copy { white-space: nowrap; padding: 0.5rem 0.875rem; }

.pin-note { font-size: 0.875rem; color: var(--color-danger); }
.expiry-note { font-size: 0.8125rem; color: var(--color-muted); }

@media (max-width: 480px) {
  .modal { border-radius: 12px 12px 0 0; max-height: 100dvh; }
  .overlay { align-items: flex-end; padding: 0; }
}
</style>

