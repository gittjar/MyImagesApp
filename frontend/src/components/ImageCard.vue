<template>
  <div class="card" @click="lightbox = true">
    <div class="thumb-wrap">
      <img :src="image.url" :alt="image.originalName" loading="lazy" />
    </div>
    <div class="card-body">
      <p class="name" :title="image.originalName">{{ image.originalName }}</p>
      <p class="meta">{{ formatSize(image.size) }} · {{ formatDate(image.createdAt) }}</p>
    </div>
    <div class="card-actions" @click.stop>
      <button class="btn-ghost btn-sm" @click="emit('delete', image._id)" title="Delete">🗑</button>
    </div>
  </div>

  <!-- Lightbox -->
  <Teleport to="body">
    <div v-if="lightbox" class="lightbox" @click.self="lightbox = false">
      <div class="lightbox-inner">
        <img :src="image.url" :alt="image.originalName" />
        <div class="lightbox-info">
          <p class="lb-name">{{ image.originalName }}</p>
          <p v-if="image.description" class="lb-desc">{{ image.description }}</p>
          <div v-if="image.tags?.length" class="tags">
            <span v-for="tag in image.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
        <button class="close-btn" @click="lightbox = false">✕</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({ image: { type: Object, required: true } });
const emit = defineEmits(['delete', 'updated']);

const lightbox = ref(false);

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-FI', { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<style scoped>
.card {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.thumb-wrap {
  aspect-ratio: 1;
  overflow: hidden;
  background: #f3f4f6;
}

.thumb-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.card:hover .thumb-wrap img {
  transform: scale(1.04);
}

.card-body {
  padding: 0.625rem 0.75rem 0.25rem;
}

.name {
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  font-size: 0.75rem;
  color: var(--color-muted);
  margin-top: 0.125rem;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0.25rem 0.5rem 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

/* Lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.lightbox-inner {
  position: relative;
  max-width: 900px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lightbox-inner img {
  width: 100%;
  max-height: 75vh;
  object-fit: contain;
  border-radius: var(--radius);
}

.lightbox-info {
  color: #fff;
}

.lb-name {
  font-weight: 600;
}

.lb-desc {
  font-size: 0.875rem;
  color: #d1d5db;
  margin-top: 0.25rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.tag {
  font-size: 0.75rem;
  background: rgba(255,255,255,0.15);
  border-radius: 999px;
  padding: 0.125rem 0.625rem;
}

.close-btn {
  position: absolute;
  top: -1rem;
  right: 0;
  background: rgba(255,255,255,0.15);
  color: #fff;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  padding: 0;
}

.close-btn:hover {
  background: rgba(255,255,255,0.3);
}
</style>
