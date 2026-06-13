<template>
  <div class="card" :data-image-id="item._id" :class="{ 'card-selected': selected }" @click="onCardClick">
    <!-- Selection checkbox -->
    <div class="select-check" @click.stop="emit('select', item._id)">
      <span class="check-box" :class="{ checked: selected }">
        <Check v-if="selected" :size="11" />
      </span>
    </div>
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
      @keydown="onLightboxKeydown"
      @touchstart.passive="onSwipeStart"
      @touchend.passive="onSwipeEnd"
      tabindex="-1"
      ref="lightboxEl"
    >
      <!-- Slideshow progress bar -->
      <div v-if="slideshowActive && currentItem.mediaType !== 'video'" class="lb-progress-bar">
        <div class="lb-progress-fill" :key="currentIdx" />
      </div>

      <!-- Top-right controls -->
      <div class="lb-topbar">
        <span v-if="items.length > 1" class="lb-counter">{{ currentIdx + 1 }} / {{ items.length }}</span>
        <button v-if="items.length > 1" class="lb-topbar-btn" @click="toggleSlideshow" :title="slideshowActive ? 'Pysäytä esitys (välilyönti)' : 'Käynnistä esitys (välilyönti)'">
          <Pause v-if="slideshowActive" :size="16" />
          <Play v-else :size="16" />
        </button>
        <button class="lb-topbar-btn" @click="toggleFullscreen" :aria-label="isFullscreen ? 'Poistu koko näytöltä' : 'Koko näyttö'">
          <Minimize2 v-if="isFullscreen" :size="16" />
          <Maximize2 v-else :size="16" />
        </button>
        <button class="lb-topbar-btn" @click="lightbox = false" aria-label="Sulje">
          <X :size="16" />
        </button>
      </div>

      <div class="lb-layout">
        <!-- Media side -->
        <div class="lb-media-wrap">
          <!-- Prev / Next arrows -->
          <button v-if="items.length > 1" class="lb-arrow lb-arrow-prev" @click.stop="prevItem" aria-label="Edellinen">
            <ChevronLeft :size="28" />
          </button>
          <button v-if="items.length > 1" class="lb-arrow lb-arrow-next" @click.stop="nextItem" aria-label="Seuraava">
            <ChevronRight :size="28" />
          </button>

          <video
            v-if="currentItem.mediaType === 'video'"
            :src="currentItem.url"
            :key="'v-' + currentIdx"
            controls
            autoplay
            class="lb-video"
            preload="metadata"
            @ended="onVideoEnded"
          />
          <img v-else :src="currentItem.url" :alt="currentItem.originalName" class="lb-img" />

          <!-- Info badge pills overlaid on media -->
          <div v-if="currentItem.description || currentItem.exif?.DateTimeOriginal || currentItem.exif?.latitude !== undefined" class="lb-badges">
            <span v-if="currentItem.description" class="lb-badge lb-badge-name">
              <Tag :size="11" />{{ currentItem.description }}
            </span>
            <span v-if="currentItem.exif?.DateTimeOriginal" class="lb-badge lb-badge-date">
              <Calendar :size="11" />{{ formatExifDate(currentItem.exif.DateTimeOriginal) }}
            </span>
            <a v-if="currentItem.exif?.latitude !== undefined" :href="mapsUrl" target="_blank" rel="noopener noreferrer" class="lb-badge lb-badge-loc" @click.stop>
              <MapPin :size="11" />{{ currentItem.exif.locationName || formatGPS(currentItem.exif.latitude, currentItem.exif.longitude) }}
            </a>
          </div>
        </div>

        <!-- Info panel -->
        <aside class="lb-panel">
          <p class="lb-filename">{{ currentItem.originalName }}</p>

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
              @keydown.esc.stop="editingDesc = false"
              autofocus
            />
            <div v-else class="lb-desc-row" @click="startEditDesc">
              <p :class="['lb-desc', !currentItem.description && 'lb-desc-empty']">{{ currentItem.description || t('media.addDescription') }}</p>
              <button class="lb-edit-btn" type="button" @click.stop="startEditDesc" :title="t('media.editDescription')"><Pencil :size="13" /></button>
            </div>
          </div>
          <div v-if="currentItem.tags?.length" class="lb-tags">
            <span v-for="tag in currentItem.tags" :key="tag" class="lb-tag">{{ tag }}</span>
          </div>

          <!-- File info -->
          <div class="lb-group">
            <div class="lb-group-label">Tiedosto</div>
            <div class="lb-row">
              <span class="lb-key">Koko</span>
              <span class="lb-val">{{ formatSize(currentItem.size) }}</span>
            </div>
            <div v-if="currentItem.width && currentItem.height" class="lb-row">
              <span class="lb-key">Resoluutio</span>
              <span class="lb-val">{{ currentItem.width }} × {{ currentItem.height }} px</span>
            </div>
            <div class="lb-row">
              <span class="lb-key">Ladattu</span>
              <span class="lb-val">{{ formatDate(currentItem.createdAt) }}</span>
            </div>
          </div>

          <!-- EXIF -->
          <template v-if="currentItem.exif && currentItem.mediaType !== 'video'">
            <div class="lb-group">
              <div class="lb-group-label">EXIF</div>
              <div v-if="currentItem.exif.DateTimeOriginal" class="lb-row">
                <span class="lb-key">Otettu</span>
                <span class="lb-val">{{ formatExifDate(currentItem.exif.DateTimeOriginal) }}</span>
              </div>
              <div v-if="currentItem.exif.Make || currentItem.exif.Model" class="lb-row">
                <span class="lb-key">Kamera</span>
                <span class="lb-val">{{ [currentItem.exif.Make, currentItem.exif.Model].filter(Boolean).join(' ') }}</span>
              </div>
              <div v-if="currentItem.exif.LensModel" class="lb-row">
                <span class="lb-key">Objektiivi</span>
                <span class="lb-val">{{ currentItem.exif.LensModel }}</span>
              </div>
              <div v-if="currentItem.exif.FNumber" class="lb-row">
                <span class="lb-key">Aukko</span>
                <span class="lb-val">f/{{ currentItem.exif.FNumber }}</span>
              </div>
              <div v-if="currentItem.exif.ExposureTime" class="lb-row">
                <span class="lb-key">Suljinaika</span>
                <span class="lb-val">{{ formatShutter(currentItem.exif.ExposureTime) }}</span>
              </div>
              <div v-if="currentItem.exif.ISO" class="lb-row">
                <span class="lb-key">ISO</span>
                <span class="lb-val">{{ currentItem.exif.ISO }}</span>
              </div>
              <div v-if="currentItem.exif.FocalLength" class="lb-row">
                <span class="lb-key">Polttoväli</span>
                <span class="lb-val">{{ Number(currentItem.exif.FocalLength).toFixed(1) }} mm</span>
              </div>
              <div v-if="currentItem.exif.Flash !== undefined && currentItem.exif.Flash !== null" class="lb-row">
                <span class="lb-key">Salama</span>
                <span class="lb-val">{{ formatFlash(currentItem.exif.Flash) }}</span>
              </div>
              <div v-if="currentItem.exif.FocalLengthIn35mmFormat" class="lb-row">
                <span class="lb-key">35mm vast.</span>
                <span class="lb-val">{{ currentItem.exif.FocalLengthIn35mmFormat }} mm</span>
              </div>
              <div v-if="currentItem.exif.ExposureBiasValue !== undefined && currentItem.exif.ExposureBiasValue !== 0" class="lb-row">
                <span class="lb-key">Korjaus</span>
                <span class="lb-val">{{ currentItem.exif.ExposureBiasValue > 0 ? '+' : '' }}{{ Number(currentItem.exif.ExposureBiasValue).toFixed(1) }} EV</span>
              </div>
              <div v-if="currentItem.exif.WhiteBalance !== undefined" class="lb-row">
                <span class="lb-key">Valkotasapaino</span>
                <span class="lb-val">{{ currentItem.exif.WhiteBalance === 0 ? 'Auto' : 'Manuaali' }}</span>
              </div>
              <div v-if="currentItem.exif.MeteringMode !== undefined" class="lb-row">
                <span class="lb-key">Mittaus</span>
                <span class="lb-val">{{ formatMeteringMode(currentItem.exif.MeteringMode) }}</span>
              </div>
              <div v-if="currentItem.exif.ExposureProgram !== undefined" class="lb-row">
                <span class="lb-key">Ohjelma</span>
                <span class="lb-val">{{ formatExposureProgram(currentItem.exif.ExposureProgram) }}</span>
              </div>
            </div>

            <!-- GPS -->
            <div v-if="currentItem.exif.latitude !== undefined" class="lb-group">
              <div class="lb-group-label">Sijainti</div>
              <div v-if="currentItem.exif.locationName" class="lb-row">
                <span class="lb-key">Paikka</span>
                <span class="lb-val">{{ currentItem.exif.locationName }}</span>
              </div>
              <div class="lb-row">
                <span class="lb-key">Koordinaatit</span>
                <span class="lb-val">{{ formatGPS(currentItem.exif.latitude, currentItem.exif.longitude) }}</span>
              </div>
              <div v-if="currentItem.exif.GPSAltitude !== undefined" class="lb-row">
                <span class="lb-key">Korkeus</span>
                <span class="lb-val">{{ Math.round(currentItem.exif.GPSAltitude) }} m</span>
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
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Play, Pause, FolderInput, Images, Folder, Share2, Trash2, X, Pencil, Maximize2, Minimize2, MapPin, Calendar, Tag, ChevronLeft, ChevronRight, Check } from 'lucide-vue-next';
import { useImagesStore } from '../stores/images';

const { t } = useI18n();

const props = defineProps({
  item: { type: Object, required: true },
  folders: { type: Array, default: () => [] },
  items: { type: Array, default: () => [] },
  startIndex: { type: Number, default: -1 },
  selected: { type: Boolean, default: false },
  selectionMode: { type: Boolean, default: false },
  forceOpen: { type: Boolean, default: false },
});
const emit = defineEmits(['delete', 'move', 'share', 'select']);

const imageStore = useImagesStore();

const lightbox = ref(false);
const lightboxEl = ref(null);
const isFullscreen = ref(false);
const showMoveMenu = ref(false);

// Navigation & slideshow
const currentIdx = ref(0);
const currentItem = computed(() =>
  props.items.length > 0 && currentIdx.value >= 0
    ? props.items[currentIdx.value]
    : props.item
);
const SLIDESHOW_INTERVAL = 4000;
const slideshowActive = ref(false);
let slideshowTimer = null;

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    lightboxEl.value?.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};
const onFullscreenChange = () => { isFullscreen.value = !!document.fullscreenElement; };

// Description editing
const editingDesc = ref(false);
const descDraft = ref('');
const startEditDesc = () => {
  descDraft.value = currentItem.value.description || '';
  editingDesc.value = true;
};
const saveDesc = async () => {
  editingDesc.value = false;
  const val = descDraft.value.trim();
  if (val === (currentItem.value.description || '')) return;
  await imageStore.updateImage(currentItem.value._id, { description: val });
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
  // Horizontal swipe: prev / next
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    if (dx < 0) nextItem(); else prevItem();
    return;
  }
  // Downward swipe: close
  if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.5) lightbox.value = false;
};

watch(lightbox, async (val) => {
  if (val) {
    await nextTick();
    lightboxEl.value?.focus();
    document.addEventListener('fullscreenchange', onFullscreenChange);
  } else {
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    if (document.fullscreenElement) document.exitFullscreen();
    isFullscreen.value = false;
    if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; }
    slideshowActive.value = false;
  }
});

const openLightbox = () => {
  showMoveMenu.value = false;
  currentIdx.value = props.startIndex >= 0 ? props.startIndex : 0;
  lightbox.value = true;
};
const onCardClick = () => {
  if (props.selectionMode) emit('select', props.item._id);
  else openLightbox();
};
watch(() => props.forceOpen, (v) => { if (v) openLightbox(); });

const move = (folderId) => {
  showMoveMenu.value = false;
  emit('move', props.item._id, folderId);
};

const mapsUrl = computed(() => {
  const lat = currentItem.value?.exif?.latitude;
  const lon = currentItem.value?.exif?.longitude;
  if (lat === undefined || lon === undefined) return '#';
  return `https://www.google.com/maps?q=${lat},${lon}`;
});

const prevItem = () => {
  if (props.items.length < 2) return;
  editingDesc.value = false;
  currentIdx.value = (currentIdx.value - 1 + props.items.length) % props.items.length;
};
const nextItem = () => {
  if (props.items.length < 2) return;
  editingDesc.value = false;
  currentIdx.value = (currentIdx.value + 1) % props.items.length;
};
const scheduleNext = () => {
  if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; }
  if (!slideshowActive.value) return;
  if (currentItem.value?.mediaType !== 'video') {
    slideshowTimer = setTimeout(() => { nextItem(); scheduleNext(); }, SLIDESHOW_INTERVAL);
  }
  // videos: handled by @ended → onVideoEnded
};
const onVideoEnded = () => {
  if (!slideshowActive.value) return;
  nextItem();
  scheduleNext();
};
const toggleSlideshow = () => {
  if (props.items.length < 2) return;
  slideshowActive.value = !slideshowActive.value;
  if (slideshowActive.value) {
    scheduleNext();
  } else {
    if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; }
  }
};
watch(currentIdx, () => {
  if (slideshowActive.value) {
    if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; }
    scheduleNext();
  }
});
const onLightboxKeydown = (e) => {
  if (editingDesc.value) return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); prevItem(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); nextItem(); }
  else if (e.key === 'Escape') lightbox.value = false;
  else if (e.key === ' ')     { e.preventDefault(); toggleSlideshow(); }
};

onUnmounted(() => {
  if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; }
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

/* ── Topbar controls ── */
.lb-topbar {
  position: absolute;
  top: 0.625rem;
  right: 0.75rem;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.lb-topbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  line-height: 1;
  flex-shrink: 0;
}
.lb-topbar-btn:hover { background: rgba(255, 255, 255, 0.24); }

.lb-counter {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.55);
  white-space: nowrap;
  user-select: none;
  margin-right: 0.125rem;
}

/* ── Prev / Next arrows ── */
.lb-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 60px;
  padding: 0;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.38);
  color: rgba(255, 255, 255, 0.85);
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}
.lb-arrow:hover { background: rgba(0, 0, 0, 0.62); }
.lb-arrow-prev { left: 0.625rem; }
.lb-arrow-next { right: 0.625rem; }

/* ── Slideshow progress bar ── */
.lb-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  z-index: 20;
  pointer-events: none;
}
.lb-progress-fill {
  height: 100%;
  background: var(--color-primary);
  animation: lb-progress 4s linear forwards;
}
@keyframes lb-progress {
  from { width: 0%; }
  to   { width: 100%; }
}

/* Badge pills over the image */
.lb-badges {
  position: absolute;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.375rem;
  padding: 0 1rem;
  pointer-events: none;
  z-index: 5;
}

.lb-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 500;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  white-space: nowrap;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: auto;
}

.lb-badge-name {
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.lb-badge-date {
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.lb-badge-loc {
  background: rgba(0, 0, 0, 0.55);
  color: #86efac;
  border: 1px solid rgba(134, 239, 172, 0.25);
  text-decoration: none;
  transition: background 0.15s;
}
.lb-badge-loc:hover { background: rgba(0, 0, 0, 0.75); }

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
  position: relative;
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

  .lb-arrow {
    top: 26dvh;
    transform: none;
    width: 36px;
    height: 48px;
  }

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

/* ── Selection ── */
.select-check {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.15s;
}
.card:hover .select-check,
.card.card-selected .select-check { opacity: 1; }

.check-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.48);
  border: 2px solid rgba(255, 255, 255, 0.75);
  color: #fff;
  transition: background 0.15s, border-color 0.15s;
  backdrop-filter: blur(4px);
}
.check-box.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.card.card-selected {
  box-shadow: 0 0 0 3px var(--color-primary), var(--shadow);
}
.card.card-selected:hover { transform: none; }
</style>
