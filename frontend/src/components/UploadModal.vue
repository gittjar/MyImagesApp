<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ t('upload.title') }}</h3>
          <button class="btn-icon close-btn" @click="emit('close')"><X :size="16" /></button>
        </div>

        <!-- Drop zone (shown when no tasks queued) -->
        <div
          v-if="!tasks.length"
          class="drop-zone"
          :class="{ dragging }"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <div class="drop-hint">
            <UploadCloud :size="44" class="drop-icon" />
            <p>{{ t('upload.dropHint') }} <strong>{{ t('upload.clickToBrowse') }}</strong></p>
            <p class="hint-sub">{{ t('upload.acceptedFormats') }}</p>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/avi,.heic,.heif,.mp4,.mov,.webm,.avi,.mkv"
            multiple
            hidden
            @change="onFileChange"
          />
        </div>

        <!-- Camera button (mobile) -->
        <div v-if="!tasks.length" class="camera-row">
          <button class="camera-btn" type="button" @click="cameraInput?.click()">
            <Camera :size="16" /> {{ t('upload.fromCamera') }}
          </button>
          <input ref="cameraInput" type="file" accept="image/*,video/*" capture="environment" hidden @change="onFileChange" />
        </div>

        <!-- File task list -->
        <div v-if="tasks.length" class="task-list">
          <div v-for="task in tasks" :key="task.name" class="task-row">
            <div class="task-thumb">
              <img v-if="task.preview" :src="task.preview" class="task-img" alt="" />
              <div v-else class="task-icon-wrap">
                <Film v-if="task.isVideo" :size="20" />
                <FileImage v-else :size="20" />
              </div>
            </div>
            <div class="task-info">
              <p class="task-name">{{ task.name }}</p>
              <div class="task-bar-wrap">
                <div class="task-bar">
                  <div class="task-fill"
                    :class="{ 'fill-done': task.status === 'done', 'fill-error': task.status === 'error' }"
                    :style="{ width: task.progress + '%' }" />
                </div>
                <span class="task-pct">
                  <span v-if="task.status === 'done'" class="pct-done">✓</span>
                  <span v-else-if="task.status === 'error'" class="pct-error">✗</span>
                  <span v-else>{{ task.progress }}%</span>
                </span>
              </div>
              <p v-if="task.error" class="task-err">{{ task.error }}</p>
            </div>
            <button v-if="task.status === 'pending'" class="task-remove btn-icon" type="button" @click="removeTask(task.name)"><X :size="13" /></button>
          </div>
          <!-- Add more -->
          <button v-if="!isUploading" class="add-more-btn" type="button" @click="fileInput?.click()">
            <Plus :size="14" /> {{ t('upload.addMore') }}
          </button>
          <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/avi,.heic,.heif,.mp4,.mov,.webm,.avi,.mkv" multiple hidden @change="onFileChange" />
        </div>

        <!-- Metadata form (pending tasks, before upload) -->
        <form v-if="tasks.length && !isUploading && !allDone" @submit.prevent="submit" class="meta-form">
          <!-- Folder selector -->
          <div v-if="props.folders.length" class="form-group">
            <label>{{ t('upload.folderLabel') }}</label>
            <select v-model="selectedFolder">
              <option value="">{{ t('upload.noFolder') }}</option>
              <option v-for="f in props.folders" :key="f._id" :value="f._id">{{ f.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ t('upload.descriptionLabel') }}</label>
            <textarea v-model="description" rows="2" :placeholder="t('upload.descriptionPlaceholder')" />
          </div>
          <div class="form-group">
            <label>{{ t('upload.tagsLabel') }} <small>{{ t('upload.tagsHint') }}</small></label>
            <input v-model="tags" type="text" :placeholder="t('upload.tagsPlaceholder')" />
          </div>
          <div class="form-group checkbox-row">
            <label>
              <input v-model="isPublic" type="checkbox" />
              {{ t('upload.makePublic') }}
            </label>
          </div>

          <p v-if="error" class="error-msg">{{ error }}</p>

          <div class="modal-actions">
            <button type="button" class="btn-ghost" @click="emit('close')">{{ t('upload.cancel') }}</button>
            <button type="submit" class="btn-primary" :disabled="pendingCount === 0">
              {{ t('upload.upload') }}{{ pendingCount > 1 ? ` (${pendingCount})` : '' }}
            </button>
          </div>
        </form>

        <!-- Done state -->
        <div v-if="allDone" class="done-state">
          <p class="done-msg">✓ {{ doneCount }} {{ t('upload.filesUploaded') }}</p>
          <div class="modal-actions done-actions">
            <button class="btn-ghost" type="button" @click="resetAndAddMore">{{ t('upload.addMore') }}</button>
            <button class="btn-primary" type="button" @click="emit('uploaded'); emit('close')">{{ t('upload.close') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { X, UploadCloud, FileImage, Film, Camera, Plus } from 'lucide-vue-next';
import { useImagesStore } from '../stores/images';

const { t } = useI18n();

const props = defineProps({
  initialFolder: { type: String, default: null },
  folders: { type: Array, default: () => [] }
});
const emit = defineEmits(['close', 'uploaded']);
const store = useImagesStore();

const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/x-matroska', 'video/x-msvideo']);
const HEIC_EXTS = new Set(['heic', 'heif']);
const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

const fileInput = ref(null);
const cameraInput = ref(null);
const dragging = ref(false);
const description = ref('');
const tags = ref('');
const isPublic = ref(false);
const selectedFolder = ref(props.initialFolder || '');
const error = ref('');
const tasks = ref([]);

const isUploading = computed(() => tasks.value.some(t => t.status === 'uploading'));
const allDone = computed(() => tasks.value.length > 0 && tasks.value.every(t => t.status === 'done' || t.status === 'error'));
const pendingCount = computed(() => tasks.value.filter(t => t.status === 'pending').length);
const doneCount = computed(() => tasks.value.filter(t => t.status === 'done').length);

const isVideoFile = (f) => {
  const ext = f.name.split('.').pop().toLowerCase();
  return VIDEO_TYPES.has(f.type) || VIDEO_EXTS.has(ext);
};
const isHeic = (f) => {
  const ext = f.name.split('.').pop().toLowerCase();
  return HEIC_TYPES.has(f.type) || HEIC_EXTS.has(ext);
};

const addFiles = (fileList) => {
  error.value = '';
  Array.from(fileList).forEach((f) => {
    const ext = f.name.split('.').pop().toLowerCase();
    const isImg = f.type.startsWith('image/') || HEIC_EXTS.has(ext);
    const isVid = isVideoFile(f);
    if (!isImg && !isVid) return;
    if (f.size > 200 * 1024 * 1024) { error.value = `${f.name}: ylittää 200 MB rajan`; return; }
    if (tasks.value.find(t => t.name === f.name)) return;
    const heic = isHeic(f);
    const video = isVideoFile(f);
    tasks.value.push({
      name: f.name, file: f, status: 'pending', progress: 0, error: '',
      preview: (heic || video) ? '' : URL.createObjectURL(f),
      isHeic: heic, isVideo: video
    });
  });
};

const onFileChange = (e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; };
const onDrop = (e) => { dragging.value = false; if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); };
const removeTask = (name) => { tasks.value = tasks.value.filter(t => t.name !== name); };
const resetAndAddMore = () => { tasks.value = tasks.value.filter(t => t.status !== 'done'); };

const submit = async () => {
  const pending = tasks.value.filter(t => t.status === 'pending');
  if (!pending.length) return;
  error.value = '';
  for (const task of pending) {
    task.status = 'uploading';
    task.progress = 0;
    try {
      const fd = new FormData();
      fd.append('image', task.file);
      fd.append('description', description.value);
      fd.append('tags', tags.value);
      fd.append('isPublic', String(isPublic.value));
      if (selectedFolder.value) fd.append('folder', selectedFolder.value);
      await store.uploadWithProgress(fd, (pct) => { task.progress = pct; });
      task.progress = 100;
      task.status = 'done';
    } catch (err) {
      task.status = 'error';
      task.error = err.response?.data?.message || 'Lataus epäonnistui';
    }
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
.close-btn { color: var(--color-muted); }

/* Drop zone */
.drop-zone {
  margin: 1.125rem 1.25rem 0;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  min-height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.drop-zone.dragging, .drop-zone:hover {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}
.drop-hint { text-align: center; color: var(--color-muted); padding: 1.5rem 1rem; }
.drop-icon { display: block; margin: 0 auto 0.5rem; }
.hint-sub { font-size: 0.7125rem; margin-top: 0.375rem; }

/* Camera row */
.camera-row { display: flex; justify-content: center; padding: 0.625rem 1.25rem 0.875rem; }
.camera-btn {
  display: flex; align-items: center; gap: 0.375rem;
  font-size: 0.8125rem; color: var(--color-muted);
  background: var(--color-surface-2); border: 1px solid var(--color-border);
  border-radius: var(--radius); padding: 0.45rem 1rem;
  transition: color 0.15s, border-color 0.15s;
}
.camera-btn:hover { color: var(--color-text); border-color: var(--color-primary); }

/* Task list */
.task-list {
  display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.875rem 1.25rem 0;
  max-height: 280px; overflow-y: auto;
}
.task-row {
  display: flex; align-items: center; gap: 0.625rem;
  background: var(--color-surface-2); border: 1px solid var(--color-border);
  border-radius: var(--radius); padding: 0.5rem 0.625rem;
}
.task-thumb {
  width: 40px; height: 40px; border-radius: 6px; overflow: hidden;
  flex-shrink: 0; background: var(--color-bg);
  display: flex; align-items: center; justify-content: center;
}
.task-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.task-icon-wrap { color: var(--color-muted); }
.task-info { flex: 1; min-width: 0; }
.task-name { font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.25rem; }
.task-bar-wrap { display: flex; align-items: center; gap: 0.375rem; }
.task-bar { flex: 1; height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden; }
.task-fill { height: 100%; border-radius: 2px; transition: width 0.15s; background: var(--color-primary); }
.fill-done { background: #4ade80; }
.fill-error { background: var(--color-danger); }
.task-pct { font-size: 0.6875rem; color: var(--color-muted); min-width: 2rem; text-align: right; }
.pct-done { color: #4ade80; font-weight: 700; }
.pct-error { color: var(--color-danger); font-weight: 700; }
.task-err { font-size: 0.6875rem; color: var(--color-danger); margin-top: 0.15rem; }
.task-remove { padding: 0.2rem; flex-shrink: 0; }
.add-more-btn {
  display: flex; align-items: center; gap: 0.375rem; justify-content: center;
  font-size: 0.8125rem; color: var(--color-muted); background: none;
  border: 1px dashed var(--color-border); border-radius: var(--radius);
  padding: 0.45rem 0.875rem; width: 100%; margin-top: 0.25rem;
  transition: color 0.15s, border-color 0.15s;
}
.add-more-btn:hover { color: var(--color-text); border-color: var(--color-primary); }

/* Done state */
.done-state { padding: 1.25rem 1.25rem 1.5rem; text-align: center; }
.done-msg { font-size: 0.9375rem; font-weight: 600; color: #4ade80; margin-bottom: 1rem; }
.done-actions { justify-content: center; }

/* Meta form */
.meta-form {
  padding: 0.875rem 1.25rem 1.25rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.checkbox-row label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; cursor: pointer; }
.checkbox-row input[type='checkbox'] { width: auto; accent-color: var(--color-primary); }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.25rem; }

@media (max-width: 480px) {
  .modal { max-height: 100dvh; border-radius: 16px 16px 0 0; }
  .overlay { align-items: flex-end; padding: 0; }
}
</style>

