<template>
  <div class="card" @click="openLightbox">
    <div class="thumb-wrap">
      <!-- Video thumbnail -->
      <div v-if="item.mediaType === 'video'" class="video-thumb">
        <video :src="item.url" preload="metadata" muted playsinline />
        <div class="play-overlay">▶</div>
      </div>
      <!-- Image thumbnail -->
      <img v-else :src="item.url" :alt="item.originalName" loading="lazy" />
    </div>
    <div class="card-body">
      <p class="name" :title="item.originalName">{{ item.originalName }}</p>
      <p class="meta">{{ formatSize(item.size) }} · {{ formatDate(item.createdAt) }}</p>
    </div>
    <div class="card-actions" @click.stop>
      <!-- Move to folder -->
      <div class="move-wrap" v-if="folders.length">
        <button class="btn-icon act-btn" title="Move to folder" @click.stop="showMoveMenu = !showMoveMenu">📂</button>
        <div v-if="showMoveMenu" class="move-menu">
          <button @click.stop="move(null)">📷 Root (no folder)</button>
          <button v-for="f in folders" :key="f._id" @click.stop="move(f._id)">📁 {{ f.name }}</button>
        </div>
      </div>
      <button class="btn-icon act-btn danger-act" @click.stop="emit('delete', item._id)" title="Delete">🗑</button>
    </div>
  </div>

  <!-- Lightbox -->
  <Teleport to="body">
    <div v-if="lightbox" class="lightbox" @click.self="lightbox = false" @keyup.esc="lightbox = false" tabindex="0">
      <button class="close-btn" @click="lightbox = false">✕</button>
      <div class="lightbox-inner">
        <!-- Video player -->
        <video
          v-if="item.mediaType === 'video'"
          :src="item.url"
          controls
          autoplay
          class="lb-video"
          preload="metadata"
        />
        <!-- Image -->
        <img v-else :src="item.url" :alt="item.originalName" class="lb-img" />

        <div class="lightbox-info">
          <p class="lb-name">{{ item.originalName }}</p>
          <p v-if="item.description" class="lb-desc">{{ item.description }}</p>
          <div v-if="item.tags?.length" class="tags">
            <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <p class="lb-meta">{{ formatSize(item.size) }} · {{ formatDate(item.createdAt) }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  item: { type: Object, required: true },
  folders: { type: Array, default: () => [] }
});
const emit = defineEmits(['delete', 'move']);

const lightbox = ref(false);
const showMoveMenu = ref(false);

const openLightbox = () => {
  showMoveMenu.value = false;
  lightbox.value = true;
};

const move = (folderId) => {
  showMoveMenu.value = false;
  emit('move', props.item._id, folderId);
};

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
.card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

.thumb-wrap {
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--color-surface-2);
}
.thumb-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
  display: block;
}
.card:hover .thumb-wrap img { transform: scale(1.04); }

/* Video thumbnail */
.video-thumb {
  width: 100%;
  height: 100%;
  position: relative;
}
.video-thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}
.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.35);
  color: #fff;
  font-size: 1.75rem;
  transition: background 0.2s;
}
.card:hover .play-overlay { background: rgba(0,0,0,0.2); }

.card-body { padding: 0.5rem 0.625rem 0.25rem; }
.name { font-size: 0.8rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta { font-size: 0.7rem; color: var(--color-muted); margin-top: 0.1rem; }

.card-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.375rem 0.375rem;
}

.act-btn { font-size: 0.875rem; padding: 0.2rem 0.35rem; }
.danger-act:hover { color: var(--color-danger); }

/* Move dropdown */
.move-wrap { position: relative; }
.move-menu {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  min-width: 170px;
  z-index: 50;
  overflow: hidden;
}
.move-menu button {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  color: var(--color-text);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.move-menu button:hover { background: var(--color-surface-2); }

/* Lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  outline: none;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255,255,255,0.1);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 1rem;
  cursor: pointer;
  z-index: 1;
}
.close-btn:hover { background: rgba(255,255,255,0.2); }

.lightbox-inner {
  max-width: 960px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lb-img {
  width: 100%;
  max-height: 72vh;
  object-fit: contain;
  border-radius: var(--radius);
}

.lb-video {
  width: 100%;
  max-height: 75vh;
  border-radius: var(--radius);
  background: #000;
}

.lightbox-info { color: #e0e0e0; }
.lb-name { font-weight: 600; font-size: 0.9375rem; }
.lb-desc { font-size: 0.875rem; color: #aaa; margin-top: 0.25rem; }
.lb-meta { font-size: 0.75rem; color: #888; margin-top: 0.375rem; }

.tags { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.5rem; }
.tag {
  background: rgba(129,140,248,0.2);
  color: var(--color-primary);
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

@media (max-width: 640px) {
  .lightbox { padding: 0.5rem; }
  .lb-img, .lb-video { max-height: 60vh; }
}
</style>
