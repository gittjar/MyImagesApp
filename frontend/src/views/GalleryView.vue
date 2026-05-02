<template>
  <div class="gallery-page">
    <Navbar />

    <div class="gallery-layout">
      <!-- ── Sidebar (folders) desktop ── -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">Folders</span>
          <button class="btn-icon" @click="showNewFolder = true" title="New folder">＋</button>
        </div>
        <nav class="folder-nav">
          <button
            class="folder-item"
            :class="{ active: imageStore.activeFolder === null }"
            @click="selectFolder(null)"
          >
            <span class="fi">📷</span>
            <span class="folder-name">All media</span>
            <span class="folder-count">{{ totalAll }}</span>
          </button>
          <button
            v-for="f in folderStore.folders"
            :key="f._id"
            class="folder-item"
            :class="{ active: imageStore.activeFolder === f._id }"
            @click="selectFolder(f._id)"
          >
            <span class="fi">📁</span>
            <span class="folder-name">{{ f.name }}</span>
            <span class="folder-count">{{ f.count }}</span>
            <button class="folder-del" @click.stop="confirmDeleteFolder(f)" title="Delete folder">✕</button>
          </button>
        </nav>
      </aside>

      <!-- ── Main content ── -->
      <main class="gallery-main">
        <!-- Mobile folder chips -->
        <div class="folder-chips">
          <button :class="['chip', imageStore.activeFolder === null ? 'chip-active' : '']" @click="selectFolder(null)">All</button>
          <button
            v-for="f in folderStore.folders"
            :key="f._id"
            :class="['chip', imageStore.activeFolder === f._id ? 'chip-active' : '']"
            @click="selectFolder(f._id)"
          >{{ f.name }}</button>
          <button class="chip chip-add" @click="showNewFolder = true">＋</button>
        </div>

        <div class="gallery-header">
          <h2>
            {{ activeFolderLabel }}
            <span class="count">{{ imageStore.total }}</span>
          </h2>
          <div class="header-actions">
            <button v-if="imageStore.activeFolder" class="btn-ghost" @click="openFolderShare">🔗 Share folder</button>
            <button class="btn-primary" @click="showUpload = true">＋ Upload</button>
          </div>
        </div>

        <!-- Storage bar -->
        <div class="storage-bar-wrap">
          <div class="storage-bar">
            <div
              class="storage-fill"
              :style="{ width: storagePercent + '%', background: storagePercent > 90 ? 'var(--color-danger)' : 'var(--color-primary)' }"
            />
          </div>
          <p class="storage-label">{{ formatBytes(imageStore.storageUsed) }} / {{ formatBytes(imageStore.storageQuota) }} used</p>
        </div>

        <div v-if="imageStore.loading" class="loading-grid">
          <div v-for="n in 12" :key="n" class="skeleton" />
        </div>

        <div v-else-if="imageStore.images.length === 0" class="empty-state">
          <p>{{ imageStore.activeFolder ? 'This folder is empty.' : 'No media yet.' }}</p>
          <button class="btn-primary" @click="showUpload = true">Upload</button>
        </div>

        <div v-else class="image-grid">
          <MediaCard
            v-for="item in imageStore.images"
            :key="item._id"
            :item="item"
            :folders="folderStore.folders"
            @delete="handleDelete"
            @move="handleMove"
            @share="handleShare"
          />
        </div>

        <div v-if="imageStore.pages > 1" class="pagination">
          <button class="btn-ghost" :disabled="imageStore.page <= 1" @click="changePage(imageStore.page - 1)">‹ Prev</button>
          <span>{{ imageStore.page }} / {{ imageStore.pages }}</span>
          <button class="btn-ghost" :disabled="imageStore.page >= imageStore.pages" @click="changePage(imageStore.page + 1)">Next ›</button>
        </div>
      </main>
    </div>

    <!-- New folder dialog -->
    <Teleport to="body">
      <div v-if="showNewFolder" class="overlay" @click.self="showNewFolder = false">
        <div class="folder-modal">
          <h3>New folder</h3>
          <input v-model="newFolderName" placeholder="Folder name" @keyup.enter="createFolder" autofocus />
          <p v-if="folderError" class="error-msg">{{ folderError }}</p>
          <div class="folder-modal-actions">
            <button class="btn-ghost" @click="showNewFolder = false">Cancel</button>
            <button class="btn-primary" @click="createFolder" :disabled="!newFolderName.trim()">Create</button>
          </div>
        </div>
      </div>
    </Teleport>

    <UploadModal
      v-if="showUpload"
      :initialFolder="imageStore.activeFolder"
      :folders="folderStore.folders"
      @close="showUpload = false"
      @uploaded="onUploaded"
    />

    <ShareModal
      v-if="showShare"
      :initialScope="shareContext.scope"
      :initialFolder="shareContext.folderId"
      :initialImageIds="shareContext.imageIds"
      :previewItem="shareContext.previewItem"
      @close="showShare = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useImagesStore } from '../stores/images';
import { useFolderStore } from '../stores/folders';
import Navbar from '../components/Navbar.vue';
import MediaCard from '../components/MediaCard.vue';
import UploadModal from '../components/UploadModal.vue';
import ShareModal from '../components/ShareModal.vue';

const imageStore = useImagesStore();
const folderStore = useFolderStore();

const showUpload = ref(false);
const showNewFolder = ref(false);
const showShare = ref(false);
const shareContext = ref({ scope: 'all', folderId: null, imageIds: [], previewItem: null });
const newFolderName = ref('');
const folderError = ref('');
const totalAll = ref(0);

const storagePercent = computed(() =>
  imageStore.storageQuota > 0 ? Math.min(100, (imageStore.storageUsed / imageStore.storageQuota) * 100) : 0
);

const activeFolderLabel = computed(() => {
  if (!imageStore.activeFolder) return 'All media';
  const f = folderStore.folders.find((f) => f._id === imageStore.activeFolder);
  return f?.name ?? 'Folder';
});

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

onMounted(async () => {
  await Promise.all([imageStore.fetchImages(1, null), folderStore.fetchFolders()]);
  totalAll.value = imageStore.total;
});

const selectFolder = async (id) => {
  await imageStore.fetchImages(1, id);
  if (!id) totalAll.value = imageStore.total;
};

const changePage = (p) => imageStore.fetchImages(p);

const createFolder = async () => {
  folderError.value = '';
  if (!newFolderName.value.trim()) return;
  try {
    await folderStore.createFolder(newFolderName.value.trim());
    newFolderName.value = '';
    showNewFolder.value = false;
  } catch (err) {
    folderError.value = err.response?.data?.message || 'Failed to create folder';
  }
};

const confirmDeleteFolder = async (folder) => {
  if (!confirm(`Delete folder "${folder.name}"? Images will be moved to root.`)) return;
  await folderStore.deleteFolder(folder._id);
  if (imageStore.activeFolder === folder._id) {
    await imageStore.fetchImages(1, null);
    totalAll.value = imageStore.total;
  }
};

const handleDelete = async (id) => {
  if (!confirm('Delete this item?')) return;
  await imageStore.deleteImage(id);
  if (!imageStore.activeFolder) totalAll.value = imageStore.total;
};

const handleShare = (item) => {
  shareContext.value = { scope: 'selection', folderId: null, imageIds: [item._id], previewItem: item };
  showShare.value = true;
};

const openFolderShare = () => {
  shareContext.value = { scope: 'folder', folderId: imageStore.activeFolder, imageIds: [], previewItem: null };
  showShare.value = true;
};

const handleMove = async (id, folderId) => {
  await imageStore.updateImage(id, { folder: folderId || '' });
  imageStore.images = imageStore.images.filter((img) => img._id !== id);
  imageStore.total = Math.max(0, imageStore.total - 1);
  await folderStore.fetchFolders();
};

const onUploaded = async () => {
  showUpload.value = false;
  await folderStore.fetchFolders();
  if (!imageStore.activeFolder) totalAll.value = imageStore.total;
};
</script>

<style scoped>
.gallery-page { min-height: 100dvh; background: var(--color-bg); }

.gallery-layout {
  display: flex;
  min-height: calc(100dvh - 56px);
}

/* ── Sidebar ── */
.sidebar {
  width: var(--sidebar-w);
  min-width: var(--sidebar-w);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  padding: 1rem 0;
  overflow-y: auto;
  position: sticky;
  top: 56px;
  height: calc(100dvh - 56px);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0.5rem;
}

.sidebar-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-muted); }

.folder-nav { display: flex; flex-direction: column; gap: 2px; padding: 0 0.5rem; }

.folder-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius);
  color: var(--color-text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.folder-item:hover { background: var(--color-surface-2); }
.folder-item.active { background: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary); }

.fi { font-size: 1rem; flex-shrink: 0; }
.folder-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folder-count { font-size: 0.7rem; color: var(--color-muted); background: var(--color-surface-2); padding: 0.1rem 0.375rem; border-radius: 999px; flex-shrink: 0; }

.folder-del {
  display: none;
  background: none;
  border: none;
  color: var(--color-muted);
  font-size: 0.7rem;
  padding: 0.1rem 0.25rem;
  cursor: pointer;
  border-radius: 3px;
}
.folder-item:hover .folder-del { display: block; }
.folder-del:hover { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 15%, transparent); }

/* ── Main ── */
.gallery-main {
  flex: 1;
  padding: 1.5rem;
  min-width: 0;
  max-width: calc(1280px - var(--sidebar-w));
}

.gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.875rem;
}

.header-actions { display: flex; gap: 0.5rem; align-items: center; }

.gallery-header h2 { font-size: 1.375rem; font-weight: 700; }
.count { font-size: 0.9rem; font-weight: 400; color: var(--color-muted); margin-left: 0.5rem; }

.storage-bar-wrap { margin-bottom: 1.25rem; }
.storage-bar { height: 5px; background: var(--color-surface-2); border-radius: 999px; overflow: hidden; margin-bottom: 0.3rem; }
.storage-fill { height: 100%; border-radius: 999px; transition: width 0.4s; }
.storage-label { font-size: 0.75rem; color: var(--color-muted); }

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.skeleton {
  aspect-ratio: 1;
  border-radius: var(--radius);
  background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-surface-2) 50%, var(--color-surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.empty-state {
  text-align: center;
  padding: 5rem 1rem;
  color: var(--color-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  color: var(--color-muted);
  font-size: 0.875rem;
}

/* Mobile folder chips (hidden on desktop) */
.folder-chips { display: none; }

/* New folder modal */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  padding: 1rem;
}

.folder-modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.folder-modal h3 { font-size: 1.125rem; font-weight: 600; }

.folder-modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }

/* ── Mobile responsive ── */
@media (max-width: 768px) {
  .sidebar { display: none; }

  .folder-chips {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
    scrollbar-width: none;
  }
  .folder-chips::-webkit-scrollbar { display: none; }

  .chip {
    flex-shrink: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    border-radius: 999px;
    padding: 0.3rem 0.875rem;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .chip-active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
  .chip-add { color: var(--color-primary); border-color: var(--color-primary); }
  .chip:hover:not(.chip-active) { background: var(--color-surface-2); }

  .gallery-main { padding: 1rem 0.875rem; }

  .image-grid,
  .loading-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.625rem;
  }
}

@media (max-width: 400px) {
  .image-grid,
  .loading-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

