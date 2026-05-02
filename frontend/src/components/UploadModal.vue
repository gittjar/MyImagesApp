<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>Upload Image</h3>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <div
          class="drop-zone"
          :class="{ dragging, 'has-file': preview }"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <img v-if="preview" :src="preview" class="preview-img" alt="preview" />
          <div v-else class="drop-hint">
            <span class="drop-icon">📁</span>
            <p>Drop image here or <strong>click to browse</strong></p>
            <p class="hint-sub">JPEG, PNG, GIF, WEBP · max 10 MB</p>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            hidden
            @change="onFileChange"
          />
        </div>

        <form v-if="file" @submit.prevent="submit" class="meta-form">
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="description" rows="2" placeholder="Optional description…" />
          </div>
          <div class="form-group">
            <label>Tags <small>(comma separated)</small></label>
            <input v-model="tags" type="text" placeholder="nature, travel, food" />
          </div>
          <div class="form-group checkbox-row">
            <label>
              <input v-model="isPublic" type="checkbox" />
              Make image public
            </label>
          </div>

          <p v-if="error" class="error-msg">{{ error }}</p>

          <div class="modal-actions">
            <button type="button" class="btn-ghost" @click="emit('close')">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="uploading">
              {{ uploading ? `Uploading ${progress}%…` : 'Upload' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';
import { useImagesStore } from '../stores/images';

const emit = defineEmits(['close', 'uploaded']);
const store = useImagesStore();

const fileInput = ref(null);
const file = ref(null);
const preview = ref('');
const description = ref('');
const tags = ref('');
const isPublic = ref(false);
const dragging = ref(false);
const uploading = ref(false);
const progress = ref(0);
const error = ref('');

const setFile = (f) => {
  if (!f || !f.type.startsWith('image/')) {
    error.value = 'Please select a valid image file.';
    return;
  }
  if (f.size > 10 * 1024 * 1024) {
    error.value = 'File exceeds 10 MB limit.';
    return;
  }
  file.value = f;
  preview.value = URL.createObjectURL(f);
  error.value = '';
};

const onFileChange = (e) => setFile(e.target.files[0]);
const onDrop = (e) => {
  dragging.value = false;
  setFile(e.dataTransfer.files[0]);
};

const submit = async () => {
  if (!file.value) return;
  uploading.value = true;
  progress.value = 0;
  error.value = '';

  try {
    const formData = new FormData();
    formData.append('image', file.value);
    formData.append('description', description.value);
    formData.append('tags', tags.value);
    formData.append('isPublic', String(isPublic.value));

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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  padding: 1rem;
}

.modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  font-size: 1.125rem;
}

.close-btn {
  background: transparent;
  color: #6b7280;
  font-size: 1rem;
  padding: 0.25rem;
}

.drop-zone {
  margin: 1.25rem 1.5rem;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  overflow: hidden;
}

.drop-zone.dragging {
  border-color: var(--color-primary);
  background: #ede9fe;
}

.drop-zone.has-file {
  border-style: solid;
  min-height: 200px;
}

.drop-hint {
  text-align: center;
  color: #9ca3af;
  padding: 2rem;
}

.drop-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.5rem;
}

.hint-sub {
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.preview-img {
  width: 100%;
  max-height: 220px;
  object-fit: contain;
}

.meta-form {
  padding: 0 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.checkbox-row label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.checkbox-row input[type='checkbox'] {
  width: auto;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.25rem;
}
</style>
