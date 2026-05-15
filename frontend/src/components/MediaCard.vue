<template>
  <div class="card" :data-image-id="item._id" @click="openLightbox">
    <div class="thumb-wrap">
      <!-- Video thumbnail -->
      <div v-if="item.mediaType === 'video'" class="video-thumb">
        <video :src="item.url" preload="metadata" muted playsinline />
        <div class="play-overlay"><Play :size="36" /></div>
      </div>
      <!-- Image thumbnail -->
      <img v-else :src="item.url" :alt="item.originalName" loading="lazy" />
    </div>

    <!-- Description ribbon — always visible when description is set -->
    <div v-if="item.description" class="desc-ribbon">
      <span class="desc-ribbon-text">{{ item.description }}</span>
    </div>

    <!-- Name/size overlay on hover -->
    <div class="card-overlay">
      <p class="name" :title="item.originalName">{{ item.originalName }}</p>
      <p class="meta">{{ formatSize(item.size) }}</p>
    </div>

    <!-- Action buttons top-right -->
    <div class="card-actions" @click.stop>
      <!-- Move to folder -->
      <div class="move-wrap" v-if="folders.length">
        <button class="act-btn" :title="t('media.moveToFolder')" @click.stop="showMoveMenu = !showMoveMenu"><FolderInput :size="14" /></button>
        <div v-if="showMoveMenu" class="move-menu">
          <button @click.stop="move(null)"><Images :size="13" /> {{ t('media.root') }}</button>
          <button v-for="f in folders" :key="f._id" @click.stop="move(f._id)"><Folder :size="13" /> {{ f.name }}</button>
        </div>
      </div>
      <button class="act-btn" @click.stop="emit('share', item)" :title="t('media.share')"><Share2 :size="14" /></button>
      <button class="act-btn danger-act" @click.stop="emit('delete', item._id)" :title="t('media.delete')"><Trash2 :size="14" /></button>
    </div>
  </div>

  <!-- Lightbox -->
  <Teleport to="body">
    <div
      v-if="lightbox"
      class="lightbox"
      @click.self="lightbox = false"
      @keydown.esc="lightbox = false"
      @touchstart.passive="onSwipeStart"
      @touchend.passive="onSwipeEnd"
      tabindex="-1"
      ref="lightboxEl"
    >
      <button class="lb-close" @click="lightbox = false" aria-label="Close">
        <X :size="20" />
      </button>

      <div class="lb-layout">
        <!-- Media side -->
        <div class="lb-media-wrap">
          <video
            v-if="item.mediaType === 'video'"
            :src="item.url"
            controls
            autoplay
            class="lb-video"
            preload="metadata"
          />
          <img v-else :src="item.url" :alt="item.originalName" class="lb-img" />
        </div>

        <!-- Info panel -->
        <aside class="lb-panel">
          <p class="lb-filename">{{ item.originalName }}</p>

          <!-- Editable description -->
          <div class="lb-desc-wrap">
            <textarea
              v-if="editingDesc"
              class="lb-desc-input"
              v-model="descDraft"
              rows="3"
              :placeholder="t('media.descriptionPlaceholder')"
              @blur="saveDesc"
              @keydown.enter.exact.prevent="saveDesc"
              @keydown.esc="editingDesc = false"
              autofocus
            />
            <div v-else class="lb-desc-row" @click="startEditDesc">
              <p :class="['lb-desc', !item.description && 'lb-desc-empty']">{{ item.description || t('media.addDescription') }}</p>
              <button class="lb-edit-btn" type="button" @click.stop="startEditDesc" :title="t('media.editDescription')"><Pencil :size="13" /></button>
            </div>
          </div>
          <div v-if="item.tags?.length" class="lb-tags">
            <span v-for="tag in item.tags" :key="tag" class="lb-tag">{{ tag }}</span>
          </div>

          <!-- File info -->
          <div class="lb-group">
            <div class="lb-group-label">Tiedosto</div>
            <div class="lb-row">
              <span class="lb-key">Koko</span>
              <span class="lb-val">{{ formatSize(item.size) }}</span>
            </div>
            <div v-if="item.width && item.height" class="lb-row">
              <span class="lb-key">Resoluutio</span>
              <span class="lb-val">{{ item.width }} × {{ item.height }} px</span>
            </div>
            <div class="lb-row">
              <span class="lb-key">Ladattu</span>
              <span class="lb-val">{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>

          <!-- EXIF -->
          <template v-if="item.exif && item.mediaType !== 'video'">
            <div class="lb-group">
              <div class="lb-group-label">EXIF</div>
              <div v-if="item.exif.DateTimeOriginal" class="lb-row">
                <span class="lb-key">Otettu</span>
                <span class="lb-val">{{ formatExifDate(item.exif.DateTimeOriginal) }}</span>
              </div>
              <div v-if="item.exif.Make || item.exif.Model" class="lb-row">
                <span class="lb-key">Kamera</span>
                <span class="lb-val">{{ [item.exif.Make, item.exif.Model].filter(Boolean).join(' ') }}</span>
              </div>
              <div v-if="item.exif.LensModel" class="lb-row">
                <span class="lb-key">Objektiivi</span>
                <span class="lb-val">{{ item.exif.LensModel }}</span>
              </div>
              <div v-if="item.exif.FNumber" class="lb-row">
                <span class="lb-key">Aukko</span>
                <span class="lb-val">f/{{ item.exif.FNumber }}</span>
              </div>
              <div v-if="item.exif.ExposureTime" class="lb-row">
                <span class="lb-key">Suljinaika</span>
                <span class="lb-val">{{ formatShutter(item.exif.ExposureTime) }}</span>
              </div>
              <div v-if="item.exif.ISO" class="lb-row">
                <span class="lb-key">ISO</span>
                <span class="lb-val">{{ item.exif.ISO }}</span>
              </div>
              <div v-if="item.exif.FocalLength" class="lb-row">
                <span class="lb-key">Polttoväli</span>
                <span class="lb-val">{{ Number(item.exif.FocalLength).toFixed(1) }} mm</span>
              </div>
              <div v-if="item.exif.Flash !== undefined && item.exif.Flash !== null" class="lb-row">
                <span class="lb-key">Salama</span>
                <span class="lb-val">{{ formatFlash(item.exif.Flash) }}</span>
              </div>
              <div v-if="item.exif.FocalLengthIn35mmFormat" class="lb-row">
                <span class="lb-key">35mm vast.</span>
                <span class="lb-val">{{ item.exif.FocalLengthIn35mmFormat }} mm</span>
              </div>
              <div v-if="item.exif.ExposureBiasValue !== undefined && item.exif.ExposureBiasValue !== 0" class="lb-row">
                <span class="lb-key">Korjaus</span>
                <span class="lb-val">{{ item.exif.ExposureBiasValue > 0 ? '+' : '' }}{{ Number(item.exif.ExposureBiasValue).toFixed(1) }} EV</span>
              </div>
              <div v-if="item.exif.WhiteBalance !== undefined" class="lb-row">
                <span class="lb-key">Valkotasapaino</span>
                <span class="lb-val">{{ item.exif.WhiteBalance === 0 ? 'Auto' : 'Manuaali' }}</span>
              </div>
              <div v-if="item.exif.MeteringMode !== undefined" class="lb-row">
                <span class="lb-key">Mittaus</span>
                <span class="lb-val">{{ formatMeteringMode(item.exif.MeteringMode) }}</span>
              </div>
              <div v-if="item.exif.ExposureProgram !== undefined" class="lb-row">
                <span class="lb-key">Ohjelma</span>
                <span class="lb-val">{{ formatExposureProgram(item.exif.ExposureProgram) }}</span>
              </div>
            </div>

            <!-- GPS -->
            <div v-if="item.exif.latitude !== undefined" class="lb-group">
              <div class="lb-group-label">Sijainti</div>
              <div class="lb-row">
                <span class="lb-key">Koordinaatit</span>
                <span class="lb-val">{{ formatGPS(item.exif.latitude, item.exif.longitude) }}</span>
              </div>
              <div v-if="item.exif.GPSAltitude !== undefined" class="lb-row">
                <span class="lb-key">Korkeus</span>
                <span class="lb-val">{{ Math.round(item.exif.GPSAltitude) }} m</span>
              </div>
              <div class="lb-row">
                <span class="lb-key"></span>
                <a :href="mapsUrl" target="_blank" rel="noopener noreferrer" class="lb-map-link">Avaa kartalla ↗</a>
              </div>
            </div>
          </template>
        </aside>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Play, FolderInput, Images, Folder, Share2, Trash2, X, Pencil } from 'lucide-vue-next';
import { useImagesStore } from '../stores/images';

const { t } = useI18n();

const props = defineProps({
  item: { type: Object, required: true },
  folders: { type: Array, default: () => [] }
});
const emit = defineEmits(['delete', 'move', 'share']);

const imageStore = useImagesStore();

const lightbox = ref(false);
const lightboxEl = ref(null);
const showMoveMenu = ref(false);

// Description editing
const editingDesc = ref(false);
const descDraft = ref('');
const startEditDesc = () => {
  descDraft.value = props.item.description || '';
  editingDesc.value = true;
};
const saveDesc = async () => {
  editingDesc.value = false;
  const val = descDraft.value.trim();
  if (val === (props.item.description || '')) return;
  await imageStore.updateImage(props.item._id, { description: val });
};

// Swipe-to-close for mobile
let _swipeStartX = 0;
let _swipeStartY = 0;
const onSwipeStart = (e) => {
  _swipeStartX = e.touches[0].clientX;
  _swipeStartY = e.touches[0].clientY;
};
const onSwipeEnd = (e) => {
  const dx = e.changedTouches[0].clientX - _swipeStartX;
  const dy = e.changedTouches[0].clientY - _swipeStartY;
  // Close on downward swipe (>80px vertical, dominant direction)
  if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.5) lightbox.value = false;
};

watch(lightbox, async (val) => {
  if (val) { await nextTick(); lightboxEl.value?.focus(); }
});

const openLightbox = () => {
  showMoveMenu.value = false;
  lightbox.value = true;
};

const move = (folderId) => {
  showMoveMenu.value = false;
  emit('move', props.item._id, folderId);
};

const mapsUrl = computed(() => {
  const lat = props.item.exif?.latitude;
  const lon = props.item.exif?.longitude;
  if (lat === undefined || lon === undefined) return '#';
  return `https://www.google.com/maps?q=${lat},${lon}`;
});

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('fi-FI', { day: 'numeric', month: 'long', year: 'numeric' });

const formatExifDate = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? String(dateVal) : d.toLocaleString('fi-FI', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

const formatShutter = (secs) => {
  if (!secs) return '';
  if (secs >= 1) return `${Number(secs).toFixed(1)} s`;
  return `1/${Math.round(1 / secs)} s`;
};

const formatGPS = (lat, lon) => {
  if (lat === undefined || lon === undefined) return '';
  return `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(6)}° ${lon >= 0 ? 'E' : 'W'}`;
};

const formatFlash = (flash) => {
  if (typeof flash === 'boolean') return flash ? 'Laukesi' : 'Ei lauennut';
  if (typeof flash === 'number') return (flash & 1) ? 'Laukesi' : 'Ei lauennut';
  return String(flash);
};

const METERING = { 0: 'Tuntematon', 1: 'Keski-arvo', 2: 'Keski-painotteinen', 3: 'Spot', 4: 'Monitäsmäys', 5: 'Arvioiva', 6: 'Osittainen' };
const formatMeteringMode = (v) => METERING[v] ?? String(v);

const EXPOSURE_PROGRAM = { 0: 'Ei käytössä', 1: 'Manuaali', 2: 'Normaali', 3: 'Aukko-etusija', 4: 'Suljin-etusija', 5: 'Luova', 6: 'Toiminta', 7: 'Muotokuva', 8: 'Maisema' };
const formatExposureProgram = (v) => EXPOSURE_PROGRAM[v] ?? String(v);
</script>

<style scoped>
.card {
  background: var(--color-surface-2);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
  aspect-ratio: 1;
}
.card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

/* Thumb fills the entire square card */
.thumb-wrap {
  position: absolute;
  inset: 0;
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
  transition: background 0.2s;
}
.card:hover .play-overlay { background: rgba(0,0,0,0.2); }

/* Description ribbon — thin black band always visible when description set */
.desc-ribbon {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.275rem 0.5rem;
  background: rgba(0, 0, 0, 0.6);
  pointer-events: none;
  z-index: 2;
}
.desc-ribbon-text {
  display: block;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Name/meta gradient overlay at the bottom */
.card-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1.5rem 0.625rem 0.5rem;
  background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%);
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 3;
}
.card:hover .card-overlay { opacity: 1; }
.name { font-size: 0.775rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta { font-size: 0.675rem; opacity: 0.8; margin-top: 0.1rem; }

/* Action buttons — absolute top-right, hidden until hover */
.card-actions {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  opacity: 0;
  transition: opacity 0.2s;
}
.card:hover .card-actions { opacity: 1; }

.act-btn {
  background: rgba(0,0,0,0.55);
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 0.8rem;
  padding: 0.2rem 0.35rem;
  cursor: pointer;
  line-height: 1;
  transition: background 0.15s;
}
.act-btn:hover { background: rgba(0,0,0,0.8); }
.danger-act:hover { background: rgba(180,0,0,0.7); }

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
  display: flex;
  align-items: center;
  gap: 0.375rem;
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

/* ── Lightbox ── */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.94);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  outline: none;
  overflow: hidden;
}

.lb-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
  line-height: 1;
}
.lb-close:hover { background: rgba(255, 255, 255, 0.24); }

.lb-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

/* ── Media area ── */
.lb-media-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 1.5rem 1.5rem;
  overflow: hidden;
}

.lb-img {
  max-width: 100%;
  max-height: calc(100dvh - 3.5rem);
  object-fit: contain;
  border-radius: 6px;
  display: block;
}

.lb-video {
  max-width: 100%;
  max-height: calc(100dvh - 3.5rem);
  border-radius: 6px;
  background: #000;
  display: block;
}

/* ── Info panel ── */
.lb-panel {
  width: 300px;
  min-width: 300px;
  background: rgba(255, 255, 255, 0.035);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  overflow-y: auto;
  padding: 3.5rem 1.25rem 1.5rem;
  color: #e8e8e8;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.lb-filename {
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  word-break: break-all;
  line-height: 1.4;
}

/* Editable description in lightbox */
.lb-desc-wrap { margin: 0.35rem 0 0.125rem; }

.lb-desc-row {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  cursor: pointer;
  border-radius: 5px;
  padding: 0.2rem 0.3rem;
  margin: -0.2rem -0.3rem;
  transition: background 0.15s;
}
.lb-desc-row:hover { background: rgba(255,255,255,0.08); }

.lb-desc { font-size: 0.8125rem; color: #d1d5db; line-height: 1.45; flex: 1; }
.lb-desc-empty { color: rgba(255,255,255,0.35); font-style: italic; }

.lb-edit-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.35);
  padding: 0.1rem;
  cursor: pointer;
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 0.1rem;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  line-height: 1;
}
.lb-desc-row:hover .lb-edit-btn { opacity: 1; color: rgba(255,255,255,0.7); }
.lb-edit-btn:hover { color: #fff; }

.lb-desc-input {
  width: 100%;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 6px;
  color: #fff;
  font-size: 0.8125rem;
  line-height: 1.45;
  padding: 0.45rem 0.625rem;
  outline: none;
  resize: vertical;
  min-height: 58px;
  font-family: inherit;
  transition: border-color 0.15s;
}
.lb-desc-input:focus { border-color: rgba(255,255,255,0.6); }

.lb-tags { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.lb-tag {
  background: rgba(129, 140, 248, 0.2);
  color: #818cf8;
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.lb-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.lb-group-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #555;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  margin-bottom: 0.1rem;
}

.lb-row {
  display: grid;
  grid-template-columns: 6.5rem 1fr;
  gap: 0.375rem;
  align-items: start;
}

.lb-key {
  color: #666;
  font-size: 0.775rem;
  line-height: 1.45;
}

.lb-val {
  color: #d8d8d8;
  font-size: 0.8rem;
  line-height: 1.45;
  word-break: break-word;
}

.lb-map-link {
  color: #818cf8;
  font-size: 0.775rem;
  text-decoration: none;
}
.lb-map-link:hover { text-decoration: underline; }

/* ── Mobile ── */
@media (max-width: 740px) {
  .lb-layout { flex-direction: column; }

  .lb-media-wrap {
    flex: none;
    height: 52dvh;
    padding: 3rem 0.75rem 0.5rem;
  }

  .lb-img, .lb-video { max-height: 52dvh; }

  .lb-panel {
    width: 100%;
    min-width: 0;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.875rem 1rem 1rem;
    flex: 1;
    min-height: 0;
    gap: 0.875rem;
  }
}
</style>
