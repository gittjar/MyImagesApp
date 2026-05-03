<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ t('share.title') }}</h3>
          <button class="btn-icon close-btn" @click="emit('close')"><X :size="16" /></button>
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
              <component :is="s.icon" :size="20" />
              <span>{{ s.label }}</span>
            </button>
          </div>
          <p class="scope-desc">{{ currentScopeDesc }}</p>

          <!-- Folder picker -->
          <div v-if="scope === 'folder'" class="form-group">
            <label>{{ t('share.chooseFolder') }}</label>
            <select v-model="selectedFolder">
              <option value="" disabled>{{ t('share.selectFolderPlaceholder') }}</option>
              <option v-for="f in folders" :key="f._id" :value="f._id">{{ f.name }}</option>
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
            {{ t('share.itemsSelected', { n: initialImageIds.length }) }}
          </p>

          <div class="form-group">
            <label>{{ t('share.titleLabel') }} <small>{{ t('share.optional') }}</small></label>
            <input v-model="title" type="text" :placeholder="t('share.titlePlaceholder')" @input="onTitleInput" />
          </div>

          <div class="form-group">
            <label>{{ t('share.linkNameLabel') }} <small>{{ t('share.required') }}</small></label>
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
            <label>{{ t('share.pinLabel') }} <small>{{ t('share.pinOptional') }}</small></label>
            <input v-model="pin" type="text" inputmode="numeric" maxlength="8" :placeholder="t('share.pinPlaceholder')" />
          </div>

          <div class="form-group">
            <label>{{ t('share.expiresLabel') }}</label>
            <select v-model="expiresInDays">
              <option value="">{{ t('share.never') }}</option>
              <option value="1">{{ t('share.day1') }}</option>
              <option value="7">{{ t('share.days7') }}</option>
              <option value="30">{{ t('share.days30') }}</option>
              <option value="90">{{ t('share.days90') }}</option>
            </select>
          </div>

          <p v-if="error" class="error-msg">{{ error }}</p>

          <div class="modal-actions">
            <button class="btn-ghost" @click="emit('close')">{{ t('share.cancel') }}</button>
            <button class="btn-primary" :disabled="loading || !slug.trim() || (scope === 'folder' && !selectedFolder)" @click="create">
              {{ loading ? t('share.creating') : t('share.createLink') }}
            </button>
          </div>
        </div>

        <!-- Success state -->
        <div v-else class="modal-body success">
          <div class="success-icon"><CheckCircle2 :size="52" color="#22c55e" /></div>
          <p class="success-label">{{ t('share.successLabel') }}</p>
          <div class="link-row">
            <input :value="shareUrl" readonly class="link-input" />
            <button class="btn-primary btn-copy" @click="copy">{{ copied ? t('share.copied') : t('share.copy') }}</button>
          </div>
          <p v-if="hasPin" class="pin-note">{{ t('share.pinNote', { pin }) }}</p>
          <p v-if="expiresAt" class="expiry-note">{{ t('share.expiresNote', { date: formatDate(expiresAt) }) }}</p>
          <div class="modal-actions">
            <button class="btn-ghost" @click="emit('close')">{{ t('share.close') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Images, Folder, Image as ImageIcon, CheckCircle2, X } from 'lucide-vue-next';
import { useFolderStore } from '../stores/folders';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

const { t } = useI18n();

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

const scopeOptions = computed(() => [
  { value: 'all',       label: t('share.allMedia'),  icon: Images },
  { value: 'folder',    label: t('share.folder'),    icon: Folder },
  { value: 'selection', label: t('share.thisItem'),  icon: ImageIcon }
]);

const scopeDescs = computed(() => ({
  all:       t('share.allMediaDesc'),
  folder:    t('share.folderDesc'),
  selection: t('share.selectionDesc')
}));

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

const currentScopeDesc = computed(() => scopeDescs.value[scope.value]);

const setScope = (s) => {
  // Don't allow changing away from selection if we were passed image IDs
  if (scope.value === 'selection' && props.initialImageIds.length > 0 && s !== 'selection') return;
  scope.value = s;
};

const create = async () => {
  if (!slug.value.trim()) {
    error.value = t('share.errLinkRequired');
    return;
  }
  if (!/^[a-z0-9_-]+$/i.test(slug.value)) {
    error.value = t('share.errLinkInvalid');
    return;
  }
  if (pin.value && !/^\d{4,8}$/.test(pin.value)) {
    error.value = t('share.errPinFormat');
    return;
  }
  if (scope.value === 'folder' && !selectedFolder.value) {
    error.value = t('share.errNoFolder');
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
    error.value = err.response?.data?.message || t('share.errGeneric');
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
.scope-tab .scope-icon { display: flex; }
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

