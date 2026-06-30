<template>
  <div class="shares-page">
    <Navbar />
    <main class="page-wrapper">
      <div class="shares-header">
        <h2>{{ t('myShares.title') }}</h2>
        <button class="btn-primary" @click="showCreate = true">
          <Plus :size="16" />
          {{ t('myShares.newShare') }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="empty-state">{{ t('myShares.loading') }}</div>

      <!-- Empty -->
      <div v-else-if="shares.length === 0" class="empty-state">
        <Share2 :size="40" class="empty-icon" />
        <p>{{ t('myShares.empty') }}</p>
        <button class="btn-primary" @click="showCreate = true">{{ t('myShares.createFirst') }}</button>
      </div>

      <!-- Table -->
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('myShares.colLink') }}</th>
              <th>{{ t('myShares.colScope') }}</th>
              <th>{{ t('myShares.colExpiry') }}</th>
              <th>{{ t('myShares.colCreated') }}</th>
              <th>{{ t('myShares.colActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in shares" :key="s.id" :class="{ expired: isExpired(s) }">
              <!-- Link name + title + PIN badge -->
              <td>
                <div class="link-cell">
                  <span class="slug">{{ s.slug }}</span>
                  <span v-if="s.title" class="share-title">{{ s.title }}</span>
                  <span v-if="s.hasPin" class="badge badge-pin" :title="t('myShares.pinProtected')">
                    <Lock :size="11" /> PIN
                  </span>
                  <span v-if="visiblePins[s.slug]" class="badge badge-pin-value" :title="t('myShares.pinVisible')">
                    {{ t('myShares.pinCode') }}: {{ visiblePins[s.slug] }}
                  </span>
                </div>
              </td>

              <!-- Scope -->
              <td>
                <span class="scope-label">
                  <component :is="scopeIcon(s)" :size="14" />
                  {{ scopeText(s) }}
                </span>
              </td>

              <!-- Expiry -->
              <td>
                <span v-if="isExpired(s)" class="badge badge-expired">{{ t('myShares.expired') }}</span>
                <span v-else-if="s.expiresAt" class="expiry-date">{{ formatDate(s.expiresAt) }}</span>
                <span v-else class="muted">{{ t('myShares.never') }}</span>
              </td>

              <!-- Created -->
              <td class="muted">{{ formatDate(s.createdAt) }}</td>

              <!-- Actions -->
              <td>
                <div class="action-btns">
                  <button class="btn-ghost btn-sm" @click="copyUrl(s)" :title="t('myShares.copy')">
                    <template v-if="copiedId === s.id"><Check :size="14" /></template>
                    <template v-else><Copy :size="14" /></template>
                  </button>
                  <button
                    v-if="s.hasPin && s.canRevealPin"
                    class="btn-ghost btn-sm"
                    @click="togglePin(s)"
                    :disabled="pinLoadingSlug === s.slug"
                    :title="visiblePins[s.slug] ? t('myShares.hidePin') : t('myShares.showPin')"
                  >
                    <Eye v-if="!visiblePins[s.slug]" :size="14" />
                    <EyeOff v-else :size="14" />
                  </button>
                  <span v-else-if="s.hasPin" class="pin-unavailable" :title="t('myShares.pinUnavailable')">{{ t('myShares.pinUnavailableShort') }}</span>
                  <a class="btn-ghost btn-sm" :href="s.url" target="_blank" rel="noopener" :title="t('myShares.open')">
                    <ExternalLink :size="14" />
                  </a>
                  <button
                    class="btn-ghost btn-sm danger-btn"
                    :class="{ 'danger-confirm': pendingDeleteSlug === s.slug }"
                    @click="remove(s)"
                    :title="pendingDeleteSlug === s.slug ? t('myShares.deleteConfirmBtn') : t('myShares.delete')"
                  >
                    <template v-if="pendingDeleteSlug === s.slug">{{ t('myShares.deleteConfirmInline') }}</template>
                    <Trash2 v-else :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <ShareModal v-if="showCreate" @close="onShareCreated" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { Plus, Share2, Lock, Copy, Check, ExternalLink, Trash2, Images, Folder, Image as ImageIcon, Eye, EyeOff } from 'lucide-vue-next';
import Navbar from '../components/Navbar.vue';
import ShareModal from '../components/ShareModal.vue';
import api from '../services/api';

const { t } = useI18n();

const shares = ref([]);
const loading = ref(true);
const showCreate = ref(false);
const copiedId = ref(null);
const visiblePins = ref({});
const pinLoadingSlug = ref('');
const pendingDeleteSlug = ref('');
let pendingDeleteTimer = null;

const fetchShares = async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/share');
    shares.value = data.shares;
  } finally {
    loading.value = false;
  }
};

onMounted(fetchShares);
onBeforeUnmount(clearPendingDelete);

const isExpired = (s) => s.expiresAt && new Date(s.expiresAt) < new Date();

const scopeIcon = (s) => {
  if (s.scope === 'folder') return Folder;
  if (s.scope === 'selection') return ImageIcon;
  return Images;
};

const scopeText = (s) => {
  if (s.scope === 'folder') return s.folderName || t('myShares.scopeFolder');
  if (s.scope === 'selection') return t('myShares.scopeSelection', { n: s.imageCount });
  return t('myShares.scopeAll');
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const copyUrl = async (s) => {
  await navigator.clipboard.writeText(s.url);
  copiedId.value = s.id;
  setTimeout(() => (copiedId.value = null), 2000);
};

const togglePin = async (s) => {
  if (visiblePins.value[s.slug]) {
    const next = { ...visiblePins.value };
    delete next[s.slug];
    visiblePins.value = next;
    return;
  }
  pinLoadingSlug.value = s.slug;
  try {
    const { data } = await api.get(`/share/item/${s.id}/pin`);
    visiblePins.value = { ...visiblePins.value, [s.slug]: data.pin };
  } catch (err) {
    alert(err.response?.data?.message || t('myShares.pinRevealFailed'));
  } finally {
    pinLoadingSlug.value = '';
  }
};

function clearPendingDelete() {
  if (pendingDeleteTimer) {
    clearTimeout(pendingDeleteTimer);
    pendingDeleteTimer = null;
  }
  pendingDeleteSlug.value = '';
}

const remove = async (s) => {
  if (pendingDeleteSlug.value !== s.slug) {
    clearPendingDelete();
    pendingDeleteSlug.value = s.slug;
    pendingDeleteTimer = setTimeout(() => {
      pendingDeleteSlug.value = '';
      pendingDeleteTimer = null;
    }, 3000);
    return;
  }

  clearPendingDelete();
  try {
    await api.delete(`/share/item/${s.id}`);
    shares.value = shares.value.filter((x) => x.id !== s.id);
  } catch (err) {
    alert(err.response?.data?.message || t('myShares.deleteFailed'));
    await fetchShares();
  }
};

const onShareCreated = () => {
  showCreate.value = false;
  fetchShares();
};
</script>

<style scoped>
.shares-page {
  min-height: 100dvh;
  background: var(--color-bg);
  color: var(--color-text);
}

.shares-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.shares-header h2 {
  font-size: 1.4rem;
  font-weight: 700;
}

.shares-header .btn-primary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 1rem;
  color: var(--color-muted);
  text-align: center;
}

.empty-icon {
  opacity: 0.35;
}

.table-wrap {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.87rem;
}

thead th {
  text-align: left;
  padding: 0.7rem 1rem;
  color: var(--color-muted);
  font-weight: 600;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--color-border);
}

tbody tr {
  border-bottom: 1px solid var(--color-border);
  transition: background 0.15s;
}

tbody tr:last-child {
  border-bottom: none;
}

tbody tr:hover {
  background: var(--color-surface-2);
}

tbody tr.expired {
  opacity: 0.55;
}

td {
  padding: 0.75rem 1rem;
  vertical-align: middle;
}

.link-cell {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.slug {
  font-family: monospace;
  font-size: 0.9em;
  color: var(--color-primary);
  font-weight: 600;
}

.share-title {
  color: var(--color-muted);
  font-size: 0.82em;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
}

.badge-pin {
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
}

.badge-pin-value {
  background: color-mix(in srgb, var(--color-primary) 20%, var(--color-surface));
  color: var(--color-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.badge-expired {
  background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  color: var(--color-danger);
}

.scope-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text);
}

.expiry-date {
  color: var(--color-text);
}

.muted {
  color: var(--color-muted);
}

.action-btns {
  display: flex;
  gap: 0.25rem;
}

.btn-sm {
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  text-decoration: none;
}

.danger-btn {
  color: var(--color-danger);
  min-width: 2.25rem;
}

.danger-btn:hover {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
}

.danger-confirm {
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
  border-color: color-mix(in srgb, var(--color-danger) 38%, var(--color-border));
  color: var(--color-danger);
  min-width: 8.5rem;
  justify-content: center;
}

.pin-unavailable {
  font-size: 0.72rem;
  color: var(--color-muted);
  padding: 0 0.2rem;
}

@media (max-width: 640px) {
  thead th:nth-child(4) {
    display: none;
  }
  td:nth-child(4) {
    display: none;
  }
}
</style>
