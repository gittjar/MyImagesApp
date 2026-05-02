<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>Upload media</h3>
          <button class="btn-icon close-btn" @click="emit('close')">✕</button>
        </div>

        <div
          class="drop-zone"
          :class="{ dragging, 'has-file': file }"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <!-- Video preview -->
          <video v-if="file && isVideo" :src="preview" class="preview-media" preload="metadata" muted />
          <!-- Image preview -->
          <img v-else-if="file && !isVideo" :src="preview" class="preview-media" alt="preview" />
          <div v-else class="drop-hint">
            <span class="drop-icon">📁</span>
            <p>Drop file here or <strong>click to browse</strong></p>
            <p class="hint-sub">Images: JPEG, PNG, GIF, WEBP, HEIC · Videos: MP4, MOV, WEBM · max 200 MB</p>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/avi,.heic,.heif,.mp4,.mov,.webm,.avi,.mkv"
            hidden
            @change="onFileChange"
          />
        </div>

        <form v-if="file" @submit.prevent="submit" class="meta-form">
          <!-- Folder selector -->
          <div v-if="folders.length" class="form-group">
            <label>Folder</label>
            <select v-model="selectedFolder">
              <option value="">— No folder (root) —</option>
              <option v-for="f in folders" :key="f._id" :value="f._id">📁 {{ f.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="description" rows="2" placeholder="Optional description…" />
          </div>
          <div v-if="!isVideo" class="form-group">
            <label>Tags <small>(comma separated)</small></label>
            <input v-model="tags" type="text" placeholder="nature, travel, food" />
          </div>
          <div class="form-group checkbox-row">
            <label>
              <input v-model="isPublic" type="checkbox" />
              Make public
            </label>
          </div>

          <p v-if="error" class="error-msg">{{ error }}</p>

          <div class="modal-actions">
            <button type="button" class="btn-ghost" @click="emit('close')">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="uploading">
              {{ uploading ? `Uploading…` : 'Upload' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useImagesStore } from '../stores/images';

const props = defineProps({
  initialFolder: { type: String, default: null },
  folders: { type: Array, default: () => [] }
});
const emit = defineEmits(['close', 'uploaded']);
const store = useImagesStore();

const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/x-matroska', 'video/x-msvideo']);

const fileInput = ref(null);
const file = ref(null);
const preview = ref('');
const description = ref('');
const tags = ref('');
const isPublic = ref(false);
const dragging = ref(false);
const uploading = ref(false);
const error = ref('');
const selectedFolder = ref(props.initialFolder || '');

const isVideo = computed(() => {
  if (!file.value) return false;
  const ext = file.value.name.split('.').pop().toLowerCase();
  return VIDEO_TYPES.has(file.value.type) || VIDEO_EXTS.has(ext);
});

const setFile = (f) => {
  if (!f) return;
  const ext = f.name.split('.').pop().toLowerCase();
  const isImg = f.type.startsWith('image/') || ['heic', 'heif'].includes(ext);
  const isVid = VIDEO_TYPES.has(f.type) || VIDEO_EXTS.has(ext);
  if (!isImg && !isVid) {
    error.value = 'Unsupported file type.';
    return;
  }
  if (f.size > 200 * 1024 * 1024) {
    error.value = 'File exceeds 200 MB limit.';
    return;
  }
  file.value = f;
  preview.value = URL.createObjectURL(f);
  error.value = '';
};

const onFileChange = (e) => setFile(e.target.files[0]);
const onDrop = (e) => { dragging.value = false; setFile(e.dataTransfer.files[0]); };

const submit = async () => {
  if (!file.value) return;
  uploading.value = true;
  error.value = '';
  try {
    const formData = new FormData();
    formData.append('image', file.value);
    formData.append('description', description.value);
    formData.append('tags', tags.value);
    formData.append('isPublic', String(isPublic.value));
    if (selectedFolder.value) formData.append('folder', selectedFolder.value);
    await store.uploadImage(formData);
    emit('uploaded');
  } catch (err) {
    error.value = err.response?.data?.message || 'Upload failed. Please try again.';
  } finally {
    uploading.value = false;
  }
};
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
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
  max-width: 480px;
  max-height: 90dvh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
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

.drop-zone {
  margin: 1.125rem 1.25rem;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  overflow: hidden;
}
.drop-zone.dragging { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 8%, transparent); }
.drop-zone.has-file { border-style: solid; border-color: var(--color-primary); }

.drop-hint { text-align: center; color: var(--color-muted); padding: 2rem; }
.drop-icon { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
.hint-sub { font-size: 0.7125rem; margin-top: 0.375rem; color: var(--color-muted); }

.preview-media {
  width: 100%;
  max-height: 220px;
  object-fit: contain;
  display: block;
}

.meta-form {
  padding: 0 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.checkbox-row label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; cursor: pointer; }
.checkbox-row input[type='checkbox'] { width: auto; accent-color: var(--color-primary); }

.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.25rem; }

@media (max-width: 480px) {
  .modal { max-height: 100dvh; border-radius: 12px 12px 0 0; }
  .overlay { align-items: flex-end; padding: 0; }
}
</style>

