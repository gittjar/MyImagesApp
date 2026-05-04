<template>
  <div class="gallery-page">
    <Navbar />

    <div class="gallery-layout">
      <!-- ── Sidebar (folders) desktop ── -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">{{ t('gallery.folders') }}</span>
          <button class="btn-icon" @click="showNewFolder = true" :title="t('gallery.newFolder')"><FolderPlus :size="16" /></button>
        </div>
        <nav class="folder-nav">
          <!-- Root / All media -->
          <div v-if="editingRootLabel" class="folder-item-edit">
            <Images :size="16" class="fi" />
            <input
              class="name-input"
              v-model="rootLabelDraft"
              @keyup.enter="saveRootLabel"
              @keyup.esc="editingRootLabel = false"
              @blur="saveRootLabel"
              autofocus
            />
          </div>
          <button
            v-else
            class="folder-item"
            :class="{ active: imageStore.activeFolder === null }"
            @click="selectFolder(null)"
          >
            <Images :size="16" class="fi" />
            <span class="folder-name">{{ rootLabel }}</span>
            <span class="folder-count">{{ totalAll }}</span>
              <button class="folder-rename" @click.stop="startEditRoot" :title="t('gallery.rename')"><Pencil :size="11" /></button>
          </button>

          <!-- Folder tree (indented by depth) -->
          <template v-for="{ folder: f, depth } in flatFolderTree" :key="f._id">
            <div v-if="editingFolderId === f._id" class="folder-item-edit" :style="{ paddingLeft: `${0.625 + depth * 0.875}rem` }">
              <Folder :size="16" class="fi" />
              <input
                class="name-input"
                v-model="folderRenameDraft"
                @keyup.enter="saveRenameFolder(f)"
                @keyup.esc="editingFolderId = null"
                @blur="saveRenameFolder(f)"
                autofocus
              />
            </div>
            <button
              v-else
              class="folder-item"
              :class="{ active: imageStore.activeFolder === f._id }"
              @click="selectFolder(f._id)"
              :style="{ paddingLeft: `${0.625 + depth * 0.875}rem` }"
            >
              <Folder :size="16" class="fi" />
              <span class="folder-name">{{ f.name }}</span>
              <span class="folder-count">{{ f.count }}</span>
              <button class="folder-rename" @click.stop="startRenameFolder(f)" :title="t('gallery.rename')"><Pencil :size="11" /></button>
              <button class="folder-del" @click.stop="confirmDeleteFolder(f)" :title="t('gallery.deleteFolder')"><X :size="11" /></button>
            </button>
          </template>
        </nav>
      </aside>

      <!-- ── Main content ── -->
      <main class="gallery-main">
        <!-- Mobile folder chips -->
        <div class="folder-chips">
          <button v-if="imageStore.activeFolder" class="chip" @click="goBack"><ChevronLeft :size="13" />{{ parentFolderLabel }}</button>
          <button v-else :class="['chip', 'chip-active']">{{ rootLabel }}</button>
          <button
            v-for="f in currentSubfolders"
            :key="f._id"
            :class="['chip', imageStore.activeFolder === f._id ? 'chip-active' : '']"
            @click="selectFolder(f._id)"
          >{{ f.name }}</button>
          <button class="chip chip-add" @click="showNewFolder = true"><Plus :size="14" /></button>
        </div>

        <!-- Back navigation when inside a folder -->
        <div v-if="imageStore.activeFolder" class="back-nav">
          <button class="btn-ghost icon-btn" @click="goBack"><ChevronLeft :size="14" />{{ parentFolderLabel }}</button>
        </div>

        <div class="gallery-header">
          <!-- Editable title -->
          <div v-if="editingHeaderLabel" class="header-title-edit">
            <input
              class="header-name-input"
              v-model="headerLabelDraft"
              @keyup.enter="saveHeaderLabel"
              @keyup.esc="editingHeaderLabel = false"
              @blur="saveHeaderLabel"
              autofocus
            />
          </div>
          <h2 v-else>
            {{ activeFolderLabel }}
            <button class="header-rename-btn" @click="startEditHeaderLabel" title="Rename"><Pencil :size="14" /></button>
            <span class="count">{{ imageStore.total }}</span>
          </h2>
          <div class="header-actions">
            <button v-if="imageStore.activeFolder" class="btn-ghost icon-btn" @click="openFolderShare"><Link2 :size="14" /> {{ t('gallery.shareFolder') }}</button>
            <button class="btn-primary icon-btn" @click="showUpload = true"><Upload :size="14" /> {{ t('gallery.upload') }}</button>
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
          <p class="storage-label">{{ t('gallery.storageUsed', { used: formatBytes(imageStore.storageUsed), quota: formatBytes(imageStore.storageQuota) }) }}</p>
        </div>

        <div v-if="imageStore.loading" class="loading-grid">
          <div v-for="n in 12" :key="n" class="skeleton" />
        </div>

        <template v-else>
          <!-- Empty state: no subfolders and no images -->
          <div v-if="!currentSubfolders.length && !imageStore.images.length" class="empty-state">
            <p>{{ imageStore.activeFolder ? t('gallery.emptyFolder') : t('gallery.noMedia') }}</p>
            <button class="btn-primary" @click="showUpload = true">{{ t('gallery.upload') }}</button>
          </div>

          <!-- Folder / subfolder tiles -->
          <div v-if="currentSubfolders.length" class="image-grid" :class="{ 'tiles-above': imageStore.images.length }">
            <div
              v-for="f in currentSubfolders"
              :key="'folder-' + f._id"
              class="folder-tile"
              @click="editingFolderId === f._id ? null : selectFolder(f._id)"
            >
              <div class="folder-tile-icon"><Folder :size="40" /></div>
              <template v-if="editingFolderId !== f._id">
                <p class="folder-tile-name">{{ f.name }}</p>
                <p class="folder-tile-count">{{ t('gallery.items', f.count) }}</p>
                <button class="folder-tile-action folder-tile-rename btn-icon" @click.stop="startRenameFolder(f)" :title="t('gallery.rename')"><Pencil :size="12" /></button>
                <button class="folder-tile-action folder-tile-del btn-icon" @click.stop="confirmDeleteFolder(f)" :title="t('gallery.deleteFolder')"><X :size="12" /></button>
              </template>
              <template v-else>
                <input
                  class="tile-name-input"
                  v-model="folderRenameDraft"
                  @keyup.enter="saveRenameFolder(f)"
                  @keyup.esc="editingFolderId = null"
                  @blur="saveRenameFolder(f)"
                  @click.stop
                  autofocus
                />
              </template>
            </div>
          </div>

          <!-- Draggable image grid -->
          <draggable
            v-if="imageStore.images.length"
            v-model="draggableImages"
            tag="div"
            class="image-grid"
            item-key="_id"
            @end="onDragEnd"
            :animation="150"
          >
            <template #item="{ element }">
              <MediaCard
                :item="element"
                :folders="folderStore.folders"
                @delete="handleDelete"
                @move="handleMove"
                @share="handleShare"
              />
            </template>
          </draggable>
        </template>

        <div v-if="imageStore.pages > 1" class="pagination">
          <button class="btn-ghost" :disabled="imageStore.page <= 1" @click="changePage(imageStore.page - 1)">{{ t('gallery.prev') }}</button>
          <span>{{ imageStore.page }} / {{ imageStore.pages }}</span>
          <button class="btn-ghost" :disabled="imageStore.page >= imageStore.pages" @click="changePage(imageStore.page + 1)">{{ t('gallery.next') }}</button>
        </div>
      </main>
    </div>

    <!-- New folder dialog -->
    <Teleport to="body">
      <div v-if="showNewFolder" class="overlay" @click.self="showNewFolder = false">
        <div class="folder-modal">
          <h3>{{ t('gallery.newFolderTitle') }}</h3>
          <input v-model="newFolderName" :placeholder="t('gallery.folderNamePlaceholder')" @keyup.enter="createFolder" autofocus />
          <p v-if="folderError" class="error-msg">{{ folderError }}</p>
          <div class="folder-modal-actions">
            <button class="btn-ghost" @click="showNewFolder = false">{{ t('gallery.cancel') }}</button>
            <button class="btn-primary" @click="createFolder" :disabled="!newFolderName.trim()">{{ t('gallery.create') }}</button>
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
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import draggable from 'vuedraggable';
import { Images, Folder, Pencil, X, FolderPlus, Plus, Link2, Upload, ChevronLeft } from 'lucide-vue-next';
import { useImagesStore } from '../stores/images';
import { useFolderStore } from '../stores/folders';
import Navbar from '../components/Navbar.vue';
import MediaCard from '../components/MediaCard.vue';
import UploadModal from '../components/UploadModal.vue';
import ShareModal from '../components/ShareModal.vue';

const { t } = useI18n();
const imageStore = useImagesStore();
const folderStore = useFolderStore();

const showUpload = ref(false);
const showNewFolder = ref(false);
const showShare = ref(false);
const shareContext = ref({ scope: 'all', folderId: null, imageIds: [], previewItem: null });
const newFolderName = ref('');
const folderError = ref('');
const totalAll = ref(0);

// ── Rename state ──
const rootLabel = ref(localStorage.getItem('rootLabel') || 'All media');
watch(rootLabel, (val) => localStorage.setItem('rootLabel', val));

const editingRootLabel = ref(false);
const rootLabelDraft = ref('');
const editingFolderId = ref(null);
const folderRenameDraft = ref('');
const editingHeaderLabel = ref(false);
const headerLabelDraft = ref('');

const startEditRoot = () => {
  rootLabelDraft.value = rootLabel.value;
  editingRootLabel.value = true;
};
const saveRootLabel = () => {
  const v = rootLabelDraft.value.trim();
  if (v) rootLabel.value = v;
  editingRootLabel.value = false;
};

const startRenameFolder = (f) => {
  folderRenameDraft.value = f.name;
  editingFolderId.value = f._id;
};
const saveRenameFolder = async (f) => {
  editingFolderId.value = null;
  const v = folderRenameDraft.value.trim();
  if (!v || v === f.name) return;
  try { await folderStore.renameFolder(f._id, v); } catch (_) {}
};

const startEditHeaderLabel = () => {
  // Renaming root or a folder via the header h2
  if (!imageStore.activeFolder) {
    headerLabelDraft.value = rootLabel.value;
  } else {
    const f = folderStore.folders.find((f) => f._id === imageStore.activeFolder);
    headerLabelDraft.value = f?.name ?? '';
  }
  editingHeaderLabel.value = true;
};
const saveHeaderLabel = async () => {
  editingHeaderLabel.value = false;
  const v = headerLabelDraft.value.trim();
  if (!v) return;
  if (!imageStore.activeFolder) {
    rootLabel.value = v;
  } else {
    const f = folderStore.folders.find((f) => f._id === imageStore.activeFolder);
    if (f && v !== f.name) {
      try { await folderStore.renameFolder(f._id, v); } catch (_) {}
    }
  }
};

const storagePercent = computed(() =>
  imageStore.storageQuota > 0 ? Math.min(100, (imageStore.storageUsed / imageStore.storageQuota) * 100) : 0
);

// ── Folder tree (flat list with depth for sidebar) ──
const flatFolderTree = computed(() => {
  const build = (parentId, depth) =>
    folderStore.folders
      .filter(f => (f.parent ? f.parent.toString() : null) === (parentId ? parentId.toString() : null))
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap(f => [{ folder: f, depth }, ...build(f._id, depth + 1)]);
  return build(null, 0);
});

// Direct children of current view (root → top-level folders, folder → subfolders)
const currentSubfolders = computed(() =>
  folderStore.folders
    .filter(f => (f.parent ? f.parent.toString() : null) === (imageStore.activeFolder ? imageStore.activeFolder.toString() : null))
    .sort((a, b) => a.name.localeCompare(b.name))
);

const currentFolderObj = computed(() =>
  folderStore.folders.find(f => f._id === imageStore.activeFolder)
);

const parentFolderLabel = computed(() => {
  if (!imageStore.activeFolder) return '';
  const par = currentFolderObj.value?.parent;
  if (!par) return rootLabel.value;
  return folderStore.folders.find(f => f._id === par.toString())?.name ?? rootLabel.value;
});

// v-model binding for vuedraggable that updates the Pinia store
const draggableImages = computed({
  get: () => imageStore.images,
  set: (val) => { imageStore.images = val; }
});

const onDragEnd = () => {
  imageStore.reorderImages(imageStore.images.map(img => img._id));
};

const goBack = async () => {
  const par = currentFolderObj.value?.parent;
  const parentId = par ? par.toString() : null;
  await selectFolder(parentId);
};

const activeFolderLabel = computed(() => {
  if (!imageStore.activeFolder) return rootLabel.value;
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
  totalAll.value = imageStore.total + folderStore.folders.length;
});

const selectFolder = async (id) => {
  await imageStore.fetchImages(1, id);
  if (!id) totalAll.value = imageStore.total + folderStore.folders.length;
};

const changePage = (p) => imageStore.fetchImages(p);

const createFolder = async () => {
  folderError.value = '';
  if (!newFolderName.value.trim()) return;
  try {
    // Create as subfolder of current folder if inside one
    await folderStore.createFolder(newFolderName.value.trim(), imageStore.activeFolder);
    newFolderName.value = '';
    showNewFolder.value = false;
  } catch (err) {
    folderError.value = err.response?.data?.message || 'Failed to create folder';
  }
};

const confirmDeleteFolder = async (folder) => {
  if (!confirm(`Delete "${folder.name}"? All subfolders will be removed and images moved to root.`)) return;
  await folderStore.deleteFolder(folder._id);
  // Refetch all folders since subfolders were also deleted server-side
  await folderStore.fetchFolders();
  // If we were inside a deleted folder (or its descendant), go back to root
  const activeStillExists = folderStore.folders.some(f => f._id === imageStore.activeFolder);
  if (!activeStillExists) {
    await selectFolder(null);
  } else {
    await imageStore.fetchImages(1, imageStore.activeFolder);
  }
  totalAll.value = imageStore.total + folderStore.folders.filter(f => !f.parent).length;
};

const handleDelete = async (id) => {
  if (!confirm('Delete this item?')) return;
  await imageStore.deleteImage(id);
  if (!imageStore.activeFolder) totalAll.value = imageStore.total + folderStore.folders.length;
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
  if (!imageStore.activeFolder) totalAll.value = imageStore.total + folderStore.folders.length;
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

.fi { flex-shrink: 0; display: flex; }
.folder-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folder-count { font-size: 0.7rem; color: var(--color-muted); background: var(--color-surface-2); padding: 0.1rem 0.375rem; border-radius: 999px; flex-shrink: 0; }

.folder-rename {
  display: none;
  background: none;
  border: none;
  color: var(--color-muted);
  font-size: 0.65rem;
  padding: 0.1rem 0.2rem;
  cursor: pointer;
  border-radius: 3px;
  flex-shrink: 0;
}
.folder-item:hover .folder-rename { display: block; }
.folder-rename:hover { color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 12%, transparent); }

.folder-del {
  display: none;
  background: none;
  border: none;
  color: var(--color-muted);
  font-size: 0.65rem;
  padding: 0.1rem 0.2rem;
  cursor: pointer;
  border-radius: 3px;
  flex-shrink: 0;
  line-height: 1;
}
.folder-item:hover .folder-del { display: block; }
.folder-del:hover { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 15%, transparent); }

/* Inline rename row in the sidebar (replaces the button) */
.folder-item-edit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}
.name-input {
  flex: 1;
  min-width: 0;
  background: var(--color-surface-2);
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  color: var(--color-text);
  font-size: 0.875rem;
  padding: 0.2rem 0.4rem;
  outline: none;
}

/* ── Header rename ── */
.header-title-edit { flex: 1; }
.header-name-input {
  font-size: 1.375rem;
  font-weight: 700;
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--color-primary);
  color: var(--color-text);
  outline: none;
  width: 100%;
  max-width: 320px;
  padding: 0 0.125rem;
}
.header-rename-btn {
  background: none;
  border: none;
  font-size: 0.9rem;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  vertical-align: middle;
  padding: 0 0.25rem;
  margin-left: 0.25rem;
  color: var(--color-muted);
}
.gallery-header:hover .header-rename-btn { opacity: 1; }
.header-rename-btn:hover { color: var(--color-primary); }

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

/* ── Folder tiles (root view) ── */
.folder-tile {
  background: var(--color-surface);
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 1rem 0.625rem;
  position: relative;
  aspect-ratio: 1;
  transition: background 0.15s, border-color 0.15s;
  text-align: center;
}
.folder-tile:hover { background: var(--color-surface-2); border-color: var(--color-primary); }
.folder-tile-icon { display: flex; }
.icon-btn { display: inline-flex; align-items: center; gap: 0.375rem; }
.folder-tile-name {
  font-size: 0.825rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  padding: 0 0.25rem;
}
.folder-tile-count { font-size: 0.7rem; color: var(--color-muted); }
.folder-tile-action {
  position: absolute;
  top: 0.3rem;
  display: none;
  font-size: 0.7rem;
  padding: 0.15rem 0.3rem;
  color: var(--color-muted);
  line-height: 1;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 3px;
}
.folder-tile:hover .folder-tile-action { display: block; }
.folder-tile-rename { right: 1.6rem; }
.folder-tile-rename:hover { color: var(--color-primary); }
.folder-tile-del { right: 0.3rem; }
.folder-tile-del:hover { color: var(--color-danger); }

/* Tile inline rename input */
.tile-name-input {
  width: calc(100% - 1rem);
  background: var(--color-surface);
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  color: var(--color-text);
  font-size: 0.825rem;
  font-weight: 600;
  text-align: center;
  padding: 0.25rem 0.375rem;
  outline: none;
  margin-top: 0.25rem;
}

.storage-bar-wrap { margin-bottom: 1.25rem; }
.storage-bar { height: 5px; background: var(--color-surface-2); border-radius: 999px; overflow: hidden; margin-bottom: 0.3rem; }
.storage-fill { height: 100%; border-radius: 999px; transition: width 0.4s; }
.storage-label { font-size: 0.75rem; color: var(--color-muted); }

/* Back navigation */
.back-nav {
  display: flex;
  align-items: center;
  margin-bottom: 0.375rem;
}
.back-nav .btn-ghost {
  font-size: 0.8125rem;
  color: var(--color-muted);
  padding: 0.2rem 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}
.back-nav .btn-ghost:hover { color: var(--color-primary); }

/* Spacing when folder tiles appear above image grid */
.tiles-above { margin-bottom: 1rem; }

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

