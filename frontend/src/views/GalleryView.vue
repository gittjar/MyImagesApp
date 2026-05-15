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
            :class="{ active: imageStore.activeFolder === null, 'sidebar-folder-drop-over': sidebarDragOver === '__root__' && isDraggingMedia }"
            data-folder-id="__root__"
            @click="selectFolder(null)"
            @dragenter.prevent="isDraggingMedia && (sidebarDragOver = '__root__')"
            @dragleave="(e) => { if (!e.currentTarget.contains(e.relatedTarget)) sidebarDragOver = null }"
            @dragover.prevent
            @drop.prevent="isDraggingMedia && onSidebarDrop('__root__', $event)"
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
              :class="{ active: imageStore.activeFolder === f._id, 'sidebar-folder-drop-over': sidebarDragOver === f._id && isDraggingMedia }"
              :data-folder-id="f._id"
              @click="selectFolder(f._id)"
              :style="{ paddingLeft: `${0.625 + depth * 0.875}rem` }"
              @dragenter.prevent="isDraggingMedia && (sidebarDragOver = f._id)"
              @dragleave="(e) => { if (!e.currentTarget.contains(e.relatedTarget)) sidebarDragOver = null }"
              @dragover.prevent
              @drop.prevent="isDraggingMedia && onSidebarDrop(f._id, $event)"
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

        <!-- ── Inline drag-drop zone ── -->
        <div
          class="inline-drop-zone"
          :class="{ 'drop-active': dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave.self="dragOver = false"
          @drop.prevent="onInlineDrop"
          @click="fileInputRef?.click()"
          :title="t('upload.dropHint')"
        >
          <Upload :size="16" class="drop-zone-icon" />
          <span>{{ dragOver ? t('upload.dropHere') : t('gallery.upload') }}</span>
          <input ref="fileInputRef" type="file" accept="image/*,video/*,.heic,.heif" multiple hidden @change="onInlineFileChange" />
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
              :class="{ 'folder-drop-ready': isDraggingMedia, 'folder-drop-over': folderDragOver === f._id }"
              @click="editingFolderId === f._id ? null : selectFolder(f._id)"
              @dragover.prevent="isDraggingMedia && (folderDragOver = f._id)"
              @dragleave="folderDragOver = null"
              @drop.prevent="isDraggingMedia && onDropImageToFolder(f)"
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

          <!-- Image grid (native HTML5 drag-to-reorder) -->
          <div
            v-if="imageStore.images.length"
            class="image-grid"
            @dragover.prevent
            @drop.prevent="onDropItem($event)"
          >
            <template v-for="slot in gridSlots" :key="slot.type === 'drop' ? '__drop__' : slot.item._id">
              <!-- Drop zone indicator -->
              <div v-if="slot.type === 'drop'" class="drop-zone-slot">
                <ImagePlus :size="28" class="drop-zone-icon" />
                <span>Pudota tähän</span>
              </div>
              <!-- Media item -->
              <div
                v-else
                class="drag-item"
                :class="{ 'drag-item-dragging': dragSrcIdx === slot.origIdx }"
                draggable="true"
                @dragstart="onDragStart($event, slot.origIdx)"
                @dragover.prevent="onDragOverItem($event, slot.origIdx)"
                @dragend="onDragEnd"
                @drop.prevent="onDropItem($event)"
              >
                <div class="drag-handle" :title="t('gallery.dragToReorder')">
                  <GripVertical :size="16" />
                </div>
                <MediaCard
                  :item="slot.item"
                  :folders="folderStore.folders"
                  @delete="handleDelete"
                  @move="handleMove"
                  @share="handleShare"
                />
              </div>
            </template>
          </div>
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

    <!-- ── Upload progress panel (fixed bottom-right) ── -->
    <Transition name="slide-up">
      <div v-if="uploadTasks.length" class="progress-panel">
        <div class="progress-panel-header">
          <span class="progress-panel-title">
            {{ isUploading ? t('upload.uploading') : (showUploadDone ? t('upload.allComplete') : t('upload.title')) }}
          </span>
          <button class="btn-icon" @click="uploadTasks = []; showUploadDone = false"><X :size="13" /></button>
        </div>
        <div class="progress-panel-tasks">
          <div v-for="task in uploadTasks" :key="task.name" class="pp-task">
            <div class="pp-task-row">
              <span class="pp-name">{{ task.name }}</span>
              <span v-if="task.status === 'done'" class="pp-done">✓</span>
              <span v-else-if="task.status === 'error'" class="pp-err">✗</span>
              <span v-else class="pp-pct">{{ task.progress }}%</span>
            </div>
            <div class="pp-bar">
              <div class="pp-fill"
                :class="{ 'pp-fill-done': task.status === 'done', 'pp-fill-err': task.status === 'error' }"
                :style="{ width: task.progress + '%' }" />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Mobile FAB (floating action button) ── -->
    <div class="upload-fab-wrap">
      <button class="upload-fab" @click="showUpload = true" :title="t('gallery.upload')">
        <Upload :size="22" />
      </button>
      <button class="camera-fab" @click="cameraInputRef?.click()" :title="t('upload.fromCamera')">
        <Camera :size="18" />
      </button>
      <input ref="cameraInputRef" type="file" accept="image/*,video/*" capture="environment" hidden @change="onInlineFileChange" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Images, Folder, Pencil, X, FolderPlus, Plus, Link2, Upload, ChevronLeft, Camera, GripVertical, ImagePlus } from 'lucide-vue-next';
import { useImagesStore } from '../stores/images';
import { useFolderStore } from '../stores/folders';
import { useConfirm } from '../composables/useConfirm';
import Navbar from '../components/Navbar.vue';
import MediaCard from '../components/MediaCard.vue';
import UploadModal from '../components/UploadModal.vue';
import ShareModal from '../components/ShareModal.vue';

const { t } = useI18n();
const { ask } = useConfirm();
const imageStore = useImagesStore();
const folderStore = useFolderStore();

const showUpload = ref(false);
const showNewFolder = ref(false);
const showShare = ref(false);
const shareContext = ref({ scope: 'all', folderId: null, imageIds: [], previewItem: null });
const newFolderName = ref('');
const folderError = ref('');
const totalAll = ref(0);

// ── Inline drag-drop upload ──
const fileInputRef = ref(null);
const cameraInputRef = ref(null);
const dragOver = ref(false);
const uploadTasks = ref([]);
const showUploadDone = ref(false);
let uploadDoneTimer = null;

// ── Image drag-to-reorder / drag-to-folder ──
const isDraggingMedia = ref(false);
const draggingImage = ref(null);
const folderDragOver = ref(null);   // _id of folder tile being hovered
const sidebarDragOver = ref(null);  // _id of sidebar folder being hovered

const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/x-matroska', 'video/x-msvideo']);
const HEIC_EXTS = new Set(['heic', 'heif']);

const isUploading = computed(() => uploadTasks.value.some(t => t.status === 'uploading' || t.status === 'pending-active'));

const uploadFiles = async (files) => {
  const ACCEPTED = /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif|tiff?|mp4|mov|m4v|webm|3gp|mkv|avi)$/i;
  const list = Array.from(files).filter(
    f => f.type.startsWith('image/') || f.type.startsWith('video/') || ACCEPTED.test(f.name)
  );
  if (!list.length) return;

  const tasks = list.map(f => ({ name: f.name, progress: 0, status: 'pending', error: '' }));
  uploadTasks.value = [...uploadTasks.value, ...tasks];
  showUploadDone.value = false;
  if (uploadDoneTimer) { clearTimeout(uploadDoneTimer); uploadDoneTimer = null; }

  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    const task = uploadTasks.value.find(t => t.name === file.name && t.status === 'pending');
    if (!task) continue;
    task.status = 'uploading';
    task.progress = 0;
    try {
      const fd = new FormData();
      fd.append('image', file);
      if (imageStore.activeFolder) fd.append('folder', imageStore.activeFolder);
      await imageStore.uploadWithProgress(fd, (pct) => { task.progress = pct; });
      task.progress = 100;
      task.status = 'done';
    } catch (e) {
      task.status = 'error';
      task.error = e.response?.data?.message || 'Lataus epäonnistui';
    }
  }

  // Refresh folders after upload
  await folderStore.fetchFolders();
  if (!imageStore.activeFolder) totalAll.value = imageStore.total + folderStore.folders.length;

  showUploadDone.value = true;
  uploadDoneTimer = setTimeout(() => {
    showUploadDone.value = false;
    uploadTasks.value = uploadTasks.value.filter(t => t.status !== 'done');
  }, 4000);
};

const onInlineDrop = (e) => { dragOver.value = false; if (e.dataTransfer?.files) uploadFiles(e.dataTransfer.files); };
const onInlineFileChange = (e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; };

// Global drag-over tracking (to show drop hint when files dragged into window)
const onWindowDragOver = (e) => { if (e.dataTransfer?.types?.includes('Files')) dragOver.value = true; };
const onWindowDragLeave = (e) => { if (!e.relatedTarget) dragOver.value = false; };
const onWindowDrop = (e) => { e.preventDefault(); dragOver.value = false; if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files); };

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

// ── Native HTML5 drag-to-reorder ──
const dragSrcIdx = ref(null);   // origIdx of the item being dragged
const dropInsertIdx = ref(null); // insertion index shown as visual drop zone

// gridSlots: images array with an optional { type: 'drop' } slot inserted
const gridSlots = computed(() => {
  const slots = imageStore.images.map((item, origIdx) => ({ type: 'item', item, origIdx }));
  const src = dragSrcIdx.value;
  const ins = dropInsertIdx.value;
  if (src === null || ins === null || ins === src || ins === src + 1) return slots;
  slots.splice(ins, 0, { type: 'drop' });
  return slots;
});

const onDragStart = (e, idx) => {
  dragSrcIdx.value = idx;
  draggingImage.value = imageStore.images[idx] ?? null;
  isDraggingMedia.value = true;
  e.dataTransfer.effectAllowed = 'move';
  document.body.classList.add('is-dragging-media');
};

const onDragOverItem = (e, idx) => {
  e.preventDefault();
  if (dragSrcIdx.value === null) return;
  folderDragOver.value = null;
  const rect = e.currentTarget.getBoundingClientRect();
  dropInsertIdx.value = e.clientX < rect.left + rect.width / 2 ? idx : idx + 1;
};

const onDragEnd = () => {
  dragSrcIdx.value = null;
  dropInsertIdx.value = null;
  isDraggingMedia.value = false;
  draggingImage.value = null;
  folderDragOver.value = null;
  sidebarDragOver.value = null;
  document.body.classList.remove('is-dragging-media');
};

const onDropItem = async (e) => {
  e.preventDefault();
  const src = dragSrcIdx.value;
  const ins = dropInsertIdx.value;
  onDragEnd();
  if (src === null || ins === null || ins === src || ins === src + 1) return;
  const items = [...imageStore.images];
  const [moved] = items.splice(src, 1);
  const adjustedIns = ins > src ? ins - 1 : ins;
  items.splice(adjustedIns, 0, moved);
  imageStore.images = items;
  await imageStore.reorderImages(items.map(img => img._id));
};

const onSidebarDrop = async (folderId, e) => {
  e.preventDefault();
  if (!isDraggingMedia.value) return;
  const image = draggingImage.value; // save before onDragEnd() resets it
  onDragEnd();
  if (!image) return;
  if (folderId === '__root__') {
    await imageStore.updateImage(image._id, { folder: null });
    imageStore.images = imageStore.images.filter(img => img._id !== image._id);
    imageStore.total = Math.max(0, imageStore.total - 1);
    await folderStore.fetchFolders();
  } else {
    const folder = folderStore.folders.find(f => f._id === folderId);
    if (folder) {
      await imageStore.updateImage(image._id, { folder: folder._id });
      imageStore.images = imageStore.images.filter(img => img._id !== image._id);
      imageStore.total = Math.max(0, imageStore.total - 1);
      await folderStore.fetchFolders();
    }
  }
};

const onDropImageToFolder = async (folder) => {
  folderDragOver.value = null;
  sidebarDragOver.value = null;
  const image = draggingImage.value;
  isDraggingMedia.value = false;
  draggingImage.value = null;
  if (!image) return;
  await imageStore.updateImage(image._id, { folder: folder._id });
  imageStore.images = imageStore.images.filter(img => img._id !== image._id);
  imageStore.total = Math.max(0, imageStore.total - 1);
  await folderStore.fetchFolders();
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
  window.addEventListener('dragover', onWindowDragOver);
  window.addEventListener('dragleave', onWindowDragLeave);
  window.addEventListener('drop', onWindowDrop);
});

onUnmounted(() => {
  window.removeEventListener('dragover', onWindowDragOver);
  window.removeEventListener('dragleave', onWindowDragLeave);
  window.removeEventListener('drop', onWindowDrop);
  if (uploadDoneTimer) clearTimeout(uploadDoneTimer);
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
  const ok = await ask({
    title: t('confirm.deleteFolder'),
    message: `"${folder.name}" — ${t('gallery.deleteFolderWarning', 'All subfolders will be removed and images moved to root.')}`,
    confirmLabel: t('confirm.deleteFolder'),
    danger: true
  });
  if (!ok) return;
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
  const ok = await ask({
    title: t('confirm.deleteItem'),
    message: t('gallery.deleteItemConfirm', 'This item will be permanently deleted.'),
    confirmLabel: t('confirm.deleteItem'),
    danger: true
  });
  if (!ok) return;
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

/* Drag-to-folder states */
.folder-drop-ready {
  border-style: solid;
  border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
}
.folder-drop-over {
  background: color-mix(in srgb, var(--color-primary) 18%, transparent) !important;
  border-color: var(--color-primary) !important;
  border-style: solid !important;
  transform: scale(1.04);
}

/* Global grabbing cursor while a media card is being dragged */
.is-dragging-media,
.is-dragging-media * {
  cursor: grabbing !important;
}

/* drag-item: wrapper with grab cursor */
.drag-item {
  position: relative;
  aspect-ratio: 1;
  cursor: grab;
}

.drag-item:active { cursor: grabbing; }

/* Faded state on the item being dragged */
.drag-item-dragging {
  opacity: 0.35;
}

/* Drag handle — visible on hover, visual only (pointer-events: none) */
.drag-handle {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(0,0,0,0.48);
  color: rgba(255,255,255,0.85);
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}

.drag-item:hover .drag-handle { opacity: 1; }

/* Sidebar folder drop highlight */
.sidebar-folder-drop-over {
  background: color-mix(in srgb, var(--color-primary) 22%, transparent) !important;
  color: var(--color-primary) !important;
  border-radius: 8px;
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

/* Arrow pointer next to folder name when it’s a drop target */
.sidebar-folder-drop-over .folder-name::before {
  content: '→ ';
  font-weight: 700;
}
/* Drop zone slot — visual insert-here indicator */
.drop-zone-slot {
  position: relative;
  aspect-ratio: 1;
  border: 2.5px dashed var(--color-primary);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  color: var(--color-primary);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  pointer-events: none;
  animation: ghost-pulse 0.9s ease-in-out infinite alternate;
}

@keyframes ghost-pulse {
  from { opacity: 0.5; }
  to   { opacity: 1; box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 20%, transparent); }
}

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

/* ── Inline drop zone ── */
.inline-drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius);
  padding: 0.625rem 1rem;
  margin-bottom: 1rem;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.8125rem;
  transition: border-color 0.2s, background 0.2s, color 0.2s;
  user-select: none;
}
.inline-drop-zone:hover, .inline-drop-zone.drop-active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 7%, transparent);
  color: var(--color-primary);
}
.drop-zone-icon { flex-shrink: 0; }

/* ── Upload progress panel ── */
.progress-panel {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 400;
  width: 300px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.progress-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid var(--color-border);
}
.progress-panel-title { font-size: 0.8125rem; font-weight: 600; }
.progress-panel-tasks { padding: 0.625rem 0.875rem; display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; }
.pp-task {}
.pp-task-row { display: flex; align-items: center; justify-content: space-between; gap: 0.375rem; margin-bottom: 0.2rem; }
.pp-name { font-size: 0.75rem; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.pp-done { font-size: 0.75rem; color: #4ade80; font-weight: 700; flex-shrink: 0; }
.pp-err { font-size: 0.75rem; color: var(--color-danger); font-weight: 700; flex-shrink: 0; }
.pp-pct { font-size: 0.75rem; color: var(--color-muted); flex-shrink: 0; }
.pp-bar { height: 3px; background: var(--color-surface-2); border-radius: 2px; overflow: hidden; }
.pp-fill { height: 100%; background: var(--color-primary); border-radius: 2px; transition: width 0.15s; }
.pp-fill-done { background: #4ade80; }
.pp-fill-err { background: var(--color-danger); }

/* slide-up transition */
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(1rem); }

/* ── Mobile FAB ── */
.upload-fab-wrap {
  display: none;
}

@media (max-width: 768px) {
  .upload-fab-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    position: fixed;
    bottom: 1.5rem;
    right: 1.25rem;
    z-index: 300;
  }
  .upload-fab {
    width: 56px;
    height: 56px;
    border-radius: 999px;
    background: var(--color-primary);
    color: #fff;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    transition: background 0.15s, transform 0.15s;
    padding: 0;
  }
  .upload-fab:hover { background: var(--color-primary-hover); transform: scale(1.06); }
  .camera-fab {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    transition: background 0.15s;
    padding: 0;
    align-self: flex-end;
  }
  .camera-fab:hover { background: var(--color-surface-2); }
  /* Hide header upload btn on mobile (uses FAB instead) */
  .gallery-header .header-actions .btn-primary { display: none; }
  /* Inline drop zone on mobile — simplified */
  .inline-drop-zone { display: none; }
  /* Progress panel on mobile — bottom, wider */
  .progress-panel { right: 0.75rem; bottom: 5rem; width: calc(100vw - 1.5rem); max-width: 320px; }
}
</style>

