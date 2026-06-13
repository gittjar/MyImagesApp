<template>
  <div class="share-page">
    <!-- Loading -->
    <div v-if="state === 'loading'" class="centered">
      <p class="muted">{{ t('shareView.loading') }}</p>
    </div>

    <!-- Not found / expired -->
    <div v-else-if="state === 'error'" class="centered">
      <div class="card-simple">
        <XCircle :size="56" class="big-icon" color="var(--color-danger)" />
        <h2>{{ t('shareView.linkNotFound') }}</h2>
        <p class="muted">{{ errorMsg }}</p>
      </div>
    </div>

    <!-- PIN entry -->
    <div v-else-if="state === 'pin'" class="centered">
      <div class="card-simple">
        <Lock :size="56" class="big-icon" :color="pinLocked ? 'var(--color-danger)' : undefined" />
        <h2>{{ shareTitle || t('shareView.protectedAlbum') }}</h2>

        <!-- Locked state -->
        <template v-if="pinLocked">
          <p class="muted pin-locked-msg">{{ t('shareView.pinLockedMsg', { until: lockedUntilFormatted }) }}</p>
        </template>

        <!-- Enter PIN state -->
        <template v-else>
          <p class="muted">{{ t('shareView.enterPin') }}</p>
          <form @submit.prevent="submitPin" class="pin-form">
            <input
              v-model="pinInput"
              type="text"
              inputmode="numeric"
              maxlength="8"
              :placeholder="t('shareView.pinPlaceholder')"
              autofocus
              class="pin-input"
              :disabled="pinLoading"
            />
            <p v-if="pinError" class="error-msg">{{ pinError }}</p>
            <!-- Attempts remaining indicator -->
            <div v-if="attemptsRemaining < maxPinAttempts && attemptsRemaining > 0" class="pin-attempts">
              <div class="pin-attempts-dots">
                <span
                  v-for="n in maxPinAttempts"
                  :key="n"
                  class="pin-dot"
                  :class="n <= attemptsRemaining ? 'pin-dot-active' : 'pin-dot-used'"
                />
              </div>
              <span class="pin-attempts-label">{{ t('shareView.attemptsRemaining', { n: attemptsRemaining, max: maxPinAttempts }) }}</span>
            </div>
            <button type="submit" class="btn-primary" :disabled="pinLoading">
              {{ pinLoading ? t('shareView.checking') : t('shareView.viewImages') }}
            </button>
          </form>
        </template>
      </div>
    </div>

    <!-- Gallery -->
    <div v-else-if="state === 'gallery'" class="gallery-wrapper">
      <header class="share-header">
        <div class="share-header-top">
          <h1>{{ shareTitle || t('shareView.sharedAlbum') }}</h1>
          <div class="share-header-actions">
            <!-- Download folder as ZIP (only for folder-scope shares) -->
            <button v-if="shareScope === 'folder'" class="btn-action" @click="downloadFolderZip" :disabled="zipDownloading" :title="t('shareView.downloadFolder')">
              <span v-if="zipDownloading" class="btn-action-spinner" />
              <FolderDown v-else :size="16" />
              {{ zipDownloading ? t('shareView.zipping') : t('shareView.downloadFolder') }}
            </button>
            <button v-if="images.length > 1" class="btn-tv" @click="enterTV" :title="t('shareView.tvMode')">
              <Tv :size="18" />
              <span>{{ t('shareView.tvMode') }}</span>
            </button>
          </div>
        </div>
        <p class="muted">{{ t('shareView.imageCount', images.length) }}</p>
      </header>

      <div class="image-grid page-wrapper">
        <div
          v-for="img in images"
          :key="img._id"
          class="thumb-card"
          @click="openLightbox(img)"
        >
          <img :src="img.url" :alt="img.originalName" loading="lazy" />
          <!-- Description ribbon -->
          <div v-if="img.description" class="thumb-desc">{{ img.description }}</div>
          <!-- EXIF pill badges (bottom-left) -->
          <div
            v-if="!dismissedPills.has(img._id) && (exifDate(img) || exifTime(img) || img.exif?.locationName)"
            class="thumb-pills"
            @click.stop
          >
            <span v-if="exifDate(img)" class="thumb-pill">
              <CalendarDays :size="10" />
              {{ exifDate(img) }}
            </span>
            <span v-if="exifTime(img)" class="thumb-pill">
              <Clock :size="10" />
              {{ exifTime(img) }}
            </span>
            <span v-if="img.exif?.locationName" class="thumb-pill thumb-pill-loc">
              <MapPin :size="10" />
              {{ img.exif.locationName }}
            </span>
            <button class="thumb-pill-close" @click.stop="dismissedPills = new Set([...dismissedPills, img._id])" :title="t('shareView.pillDismiss')">
              <X :size="9" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TV Slideshow -->
    <Teleport to="body">
      <div v-if="tvMode" class="tv-overlay" @click="showTVControlsBriefly">
        <Transition name="tv-cross" mode="out-in">
          <img
            :key="tvIndex"
            :src="images[tvIndex]?.url"
            :alt="images[tvIndex]?.originalName"
            class="tv-img"
          />
        </Transition>

        <Transition name="tv-fade">
          <div v-if="tvShowControls" class="tv-controls">
            <div class="tv-top-bar">
              <span class="tv-title">{{ shareTitle }}</span>
              <div class="tv-top-right">
                <span class="tv-counter">{{ tvIndex + 1 }} / {{ images.length }}</span>
                <button class="tv-icon-btn" @click.stop="exitTV" :title="t('shareView.exitTV')">
                  <X :size="22" />
                </button>
              </div>
            </div>
            <button class="tv-nav tv-prev" @click.stop="tvPrev" :aria-label="t('shareView.prev')">
              <ChevronLeft :size="48" />
            </button>
            <button class="tv-nav tv-next" @click.stop="tvNext" :aria-label="t('shareView.next')">
              <ChevronRight :size="48" />
            </button>
            <div class="tv-bottom-bar">
              <button class="tv-play-btn" @click.stop="tvTogglePlay">
                <Pause v-if="tvPlaying" :size="26" />
                <Play v-else :size="26" />
              </button>
              <p class="tv-caption" v-if="images[tvIndex]?.description">{{ images[tvIndex].description }}</p>
            </div>
          </div>
        </Transition>
      </div>
    </Teleport>

    <!-- Lightbox -->
    <Teleport to="body">
      <div v-if="lightboxImg" class="lightbox" @click.self="lightboxImg = null" @keydown.esc="lightboxImg = null" tabindex="-1">
        <div class="lb-layout">
          <!-- Media area -->
          <div class="lb-media">
            <button class="lb-nav lb-nav-prev" v-if="images.length > 1" @click="lbPrev">
              <ChevronLeft :size="32" />
            </button>
            <button class="lb-nav lb-nav-next" v-if="images.length > 1" @click="lbNext">
              <ChevronRight :size="32" />
            </button>
            <video
              v-if="lightboxImg.mediaType === 'video'"
              :src="lightboxImg.url"
              controls
              autoplay
              class="lb-img"
              preload="metadata"
            />
            <img v-else :src="lightboxImg.url" :alt="lightboxImg.originalName" class="lb-img" />
            <!-- EXIF pill badges on lightbox image -->
            <div
              v-if="!lbPillsDismissed && (exifDate(lightboxImg) || exifTime(lightboxImg) || lightboxImg.exif?.locationName)"
              class="lb-exif-pills"
            >
              <span v-if="lightboxImg.exif?.locationName" class="lb-pill lb-pill-loc">
                <MapPin :size="11" />
                {{ lightboxImg.exif.locationName }}
              </span>
              <span v-if="exifDate(lightboxImg)" class="lb-pill">
                <CalendarDays :size="11" />
                {{ exifDate(lightboxImg) }}
              </span>
              <span v-if="exifTime(lightboxImg)" class="lb-pill">
                <Clock :size="11" />
                {{ exifTime(lightboxImg) }}
              </span>
              <button class="lb-pill-close" @click.stop="lbPillsDismissed = true" :title="t('shareView.pillDismiss')">
                <X :size="10" />
              </button>
            </div>
            <div class="lb-counter" v-if="images.length > 1">{{ lightboxIndex + 1 }} / {{ images.length }}</div>
            <button class="lb-close" @click="lightboxImg = null"><X :size="20" /></button>
          </div>

          <!-- Info sidebar -->
          <aside class="lb-sidebar">
            <div class="lb-sidebar-scroll">
              <!-- Name & description -->
              <div class="lb-section lb-section-title">
                <p class="lb-filename">{{ lightboxImg.originalName }}</p>
                <p v-if="lightboxImg.description" class="lb-desc">{{ lightboxImg.description }}</p>
              </div>

              <!-- Download button -->
              <a
                class="btn-download lb-download"
                :href="lightboxImg.url"
                :download="lightboxImg.originalName"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
              >
                <Download :size="15" />
                {{ t('shareView.downloadImage') }}
              </a>

              <!-- Photo info -->
              <div class="lb-section">
                <div class="lb-section-label">{{ t('shareView.infoSectionFile') }}</div>
                <div class="lb-row">
                  <span class="lb-key">{{ t('shareView.infoSize') }}</span>
                  <span class="lb-val">{{ formatSize(lightboxImg.size) }}</span>
                </div>
                <div v-if="lightboxImg.width && lightboxImg.height" class="lb-row">
                  <span class="lb-key">{{ t('shareView.infoDimensions') }}</span>
                  <span class="lb-val">{{ lightboxImg.width }} × {{ lightboxImg.height }} px</span>
                </div>
              </div>

              <!-- EXIF date / location / camera -->
              <template v-if="lightboxImg.exif">
                <div class="lb-section">
                  <div class="lb-section-label">{{ t('shareView.infoSectionExif') }}</div>
                  <div v-if="lightboxImg.exif.DateTimeOriginal" class="lb-row">
                    <span class="lb-key"><Calendar :size="13" /></span>
                    <span class="lb-val">{{ formatExifDate(lightboxImg.exif.DateTimeOriginal) }}</span>
                  </div>
                  <div v-if="lightboxImg.exif.Make || lightboxImg.exif.Model" class="lb-row">
                    <span class="lb-key"><Camera :size="13" /></span>
                    <span class="lb-val">{{ [lightboxImg.exif.Make, lightboxImg.exif.Model].filter(Boolean).join(' ') }}</span>
                  </div>
                  <div v-if="lightboxImg.exif.LensModel" class="lb-row">
                    <span class="lb-key">{{ t('shareView.infoLens') }}</span>
                    <span class="lb-val">{{ lightboxImg.exif.LensModel }}</span>
                  </div>
                  <div v-if="lightboxImg.exif.FNumber" class="lb-row">
                    <span class="lb-key">{{ t('shareView.infoAperture') }}</span>
                    <span class="lb-val">f/{{ lightboxImg.exif.FNumber }}</span>
                  </div>
                  <div v-if="lightboxImg.exif.ExposureTime" class="lb-row">
                    <span class="lb-key">{{ t('shareView.infoShutter') }}</span>
                    <span class="lb-val">{{ formatShutter(lightboxImg.exif.ExposureTime) }}</span>
                  </div>
                  <div v-if="lightboxImg.exif.ISO" class="lb-row">
                    <span class="lb-key">ISO</span>
                    <span class="lb-val">{{ lightboxImg.exif.ISO }}</span>
                  </div>
                </div>

                <!-- GPS -->
                <div v-if="lightboxImg.exif.latitude !== undefined" class="lb-section">
                  <div class="lb-section-label">{{ t('shareView.infoSectionLocation') }}</div>
                  <div v-if="lightboxImg.exif.locationName" class="lb-row">
                    <span class="lb-key"><MapPin :size="13" /></span>
                    <span class="lb-val">{{ lightboxImg.exif.locationName }}</span>
                  </div>
                  <div class="lb-row">
                    <span class="lb-key">GPS</span>
                    <span class="lb-val">{{ formatGPS(lightboxImg.exif.latitude, lightboxImg.exif.longitude) }}</span>
                  </div>
                  <div class="lb-row">
                    <span class="lb-key" />
                    <a
                      class="lb-maps-link"
                      :href="`https://www.google.com/maps?q=${lightboxImg.exif.latitude},${lightboxImg.exif.longitude}`"
                      target="_blank"
                      rel="noopener noreferrer"
                    >{{ t('shareView.openOnMap') }} ↗</a>
                  </div>
                </div>
              </template>
            </div>
          </aside>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { XCircle, Lock, X, Tv, Play, Pause, ChevronLeft, ChevronRight, Download, FolderDown, Camera, MapPin, Calendar, CalendarDays, Clock } from 'lucide-vue-next';
import { useRoute } from 'vue-router';
import api from '../services/api';

const { t } = useI18n();
const route = useRoute();
const { userId, slug } = route.params;

const state = ref('loading'); // loading | pin | gallery | error
const shareTitle = ref('');
const shareScope = ref('');
const images = ref([]);
const pinInput = ref('');
const pinError = ref('');
const pinLoading = ref(false);
const pinLocked = ref(false);
const pinLockedUntil = ref(null);
const attemptsRemaining = ref(5);
const maxPinAttempts = ref(5);
const errorMsg = ref('');

// Dismissed pill groups (per image _id)
const dismissedPills = ref(new Set());

// ── EXIF pill helpers ──────────────────────────────────────────────────────
function exifDate(img) {
  const raw = img?.exif?.DateTimeOriginal;
  if (!raw) return null;
  const str = String(raw);
  const m = str.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (m) {
    try {
      const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
      return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (_) { return null; }
  }
  return null;
}

function exifTime(img) {
  const raw = img?.exif?.DateTimeOriginal;
  if (!raw) return null;
  const str = String(raw);
  const m = str.match(/^\d{4}:\d{2}:\d{2} (\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

// Lightbox
const lightboxImg = ref(null);
const lightboxIndex = ref(0);
const lbPillsDismissed = ref(false);

function openLightbox(img) {
  lightboxImg.value = img;
  lightboxIndex.value = images.value.findIndex(i => i._id === img._id);
  lbPillsDismissed.value = false;
}
function lbPrev() {
  lightboxIndex.value = (lightboxIndex.value - 1 + images.value.length) % images.value.length;
  lightboxImg.value = images.value[lightboxIndex.value];
  lbPillsDismissed.value = false;
}
function lbNext() {
  lightboxIndex.value = (lightboxIndex.value + 1) % images.value.length;
  lightboxImg.value = images.value[lightboxIndex.value];
  lbPillsDismissed.value = false;
}

const lockedUntilFormatted = computed(() => {
  if (!pinLockedUntil.value) return '';
  return new Date(pinLockedUntil.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

// TV / Slideshow mode
const tvMode = ref(false);
const tvIndex = ref(0);
const tvPlaying = ref(true);
const tvTimer = ref(null);
const tvShowControls = ref(true);
const tvControlsTimer = ref(null);
const TV_INTERVAL = 5000;

// ZIP download
const zipDownloading = ref(false);
const cachedPin = ref('');

async function downloadFolderZip() {
  zipDownloading.value = true;
  try {
    const resp = await fetch(`/api/share/${userId}/${slug}/download-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cachedPin.value ? { pin: cachedPin.value } : {}),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      alert(err.message || t('shareView.zipError'));
      return;
    }
    const blob = await resp.blob();
    const cd = resp.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : 'shared-folder.zip';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (e) {
    alert(t('shareView.zipError'));
  } finally {
    zipDownloading.value = false;
  }
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatExifDate(raw) {
  if (!raw) return '';
  if (raw instanceof Date) return raw.toLocaleString();
  const str = String(raw);
  const m = str.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    try {
      const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
      return d.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return str; }
  }
  return str;
}

function formatShutter(v) {
  if (!v) return '';
  if (v < 1) return `1/${Math.round(1 / v)}s`;
  return `${v}s`;
}

function formatGPS(lat, lon) {
  if (lat === undefined || lon === undefined) return '';
  const fmtDeg = (v, pos, neg) => {
    const d = Math.abs(v);
    const deg = Math.floor(d);
    const min = (d - deg) * 60;
    return `${deg}°${min.toFixed(2)}'${v >= 0 ? pos : neg}`;
  };
  return `${fmtDeg(lat, 'N', 'S')} ${fmtDeg(lon, 'E', 'W')}`;
}

function enterTV() {
  tvIndex.value = 0;
  tvMode.value = true;
  tvPlaying.value = true;
  startTVTimer();
  showTVControlsBriefly();
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}

function exitTV() {
  tvMode.value = false;
  stopTVTimer();
  clearTVControlsTimer();
  tvShowControls.value = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

function startTVTimer() {
  stopTVTimer();
  if (!tvPlaying.value || images.value.length < 2) return;
  tvTimer.value = setInterval(() => {
    tvIndex.value = (tvIndex.value + 1) % images.value.length;
  }, TV_INTERVAL);
}

function stopTVTimer() {
  if (tvTimer.value) { clearInterval(tvTimer.value); tvTimer.value = null; }
}

function clearTVControlsTimer() {
  if (tvControlsTimer.value) { clearTimeout(tvControlsTimer.value); tvControlsTimer.value = null; }
}

function tvNext() {
  tvIndex.value = (tvIndex.value + 1) % images.value.length;
  if (tvPlaying.value) startTVTimer();
  showTVControlsBriefly();
}

function tvPrev() {
  tvIndex.value = (tvIndex.value - 1 + images.value.length) % images.value.length;
  if (tvPlaying.value) startTVTimer();
  showTVControlsBriefly();
}

function tvTogglePlay() {
  tvPlaying.value = !tvPlaying.value;
  if (tvPlaying.value) startTVTimer(); else stopTVTimer();
  showTVControlsBriefly();
}

function showTVControlsBriefly() {
  tvShowControls.value = true;
  clearTVControlsTimer();
  tvControlsTimer.value = setTimeout(() => { tvShowControls.value = false; }, 3500);
}

function onKeyDown(e) {
  if (lightboxImg.value && !tvMode.value) {
    if (e.key === 'ArrowRight') { e.preventDefault(); lbNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); lbPrev(); }
    else if (e.key === 'Escape') lightboxImg.value = null;
    return;
  }
  if (!tvMode.value) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); tvNext(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); tvPrev(); }
  else if (e.key === ' ') { e.preventDefault(); tvTogglePlay(); }
  else if (e.key === 'Escape') exitTV();
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown);
  try {
    const { data } = await api.get(`/share/${userId}/${slug}`);
    shareTitle.value = data.title;
    shareScope.value = data.scope;

    if (data.hasPin) {
      pinLocked.value = data.pinLocked || false;
      pinLockedUntil.value = data.pinLockedUntil || null;
      attemptsRemaining.value = data.attemptsRemaining ?? 5;
      maxPinAttempts.value = data.maxAttempts ?? 5;
      state.value = 'pin';
    } else {
      await loadImages();
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Share link not found or expired.';
    state.value = 'error';
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  stopTVTimer();
  clearTVControlsTimer();
});

const loadImages = async (pin = undefined) => {
  const { data } = await api.post(`/share/${userId}/${slug}/images`, pin ? { pin } : {});
  shareTitle.value = data.title || shareTitle.value;
  shareScope.value = data.scope || shareScope.value;
  images.value = data.images;
  if (pin) cachedPin.value = pin;
  state.value = 'gallery';
  if (route.query.tv === '1') {
    await nextTick();
    enterTV();
  }
};

const submitPin = async () => {
  pinError.value = '';
  pinLoading.value = true;
  try {
    await loadImages(pinInput.value);
  } catch (err) {
    const d = err.response?.data || {};
    if (d.pinLocked) {
      pinLocked.value = true;
      pinLockedUntil.value = d.lockedUntil || null;
      attemptsRemaining.value = 0;
    } else if (d.attemptsRemaining !== undefined) {
      attemptsRemaining.value = d.attemptsRemaining;
    }
    pinError.value = d.message || t('shareView.incorrectPin');
  } finally {
    pinLoading.value = false;
  }
};
</script>

<style scoped>
/* ── Base ── */
.share-page {
  min-height: 100vh;
  background: var(--color-bg);
}

.centered {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.card-simple {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 2.5rem 2rem;
  max-width: 380px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.875rem;
  text-align: center;
}

.big-icon { font-size: 3rem; }
.muted { color: var(--color-muted); font-size: 0.875rem; }

/* ── PIN form ── */
.pin-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.pin-input {
  text-align: center;
  font-size: 1.5rem;
  letter-spacing: 0.3em;
  padding: 0.75rem;
}

.pin-locked-msg {
  color: var(--color-danger);
  font-weight: 600;
}

.pin-attempts {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.pin-attempts-dots {
  display: flex;
  gap: 0.375rem;
}

.pin-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  transition: background 0.2s;
}
.pin-dot-active { background: var(--color-primary); }
.pin-dot-used { background: var(--color-danger); }

.pin-attempts-label {
  font-size: 0.75rem;
  color: var(--color-danger);
  font-weight: 500;
}

/* ── Gallery ── */
.gallery-wrapper {
  padding-bottom: 3rem;
}

.share-header {
  padding: 2rem 1.5rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.share-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
}

.share-header .muted {
  margin-top: 0.25rem;
}

.share-header-top {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.share-header-top h1 {
  flex: 1;
  min-width: 0;
}

.share-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* ── Buttons ── */
.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  font-size: 0.875rem;
  color: var(--color-text);
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn-action:hover:not(:disabled) {
  background: var(--color-surface-2);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.btn-action:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-action-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.btn-download {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
  width: 100%;
  justify-content: center;
}
.btn-download:hover { background: var(--color-primary-hover, #7c3aed); }

.btn-tv {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  font-size: 0.875rem;
  color: var(--color-text);
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
  cursor: pointer;
  flex-shrink: 0;
}
.btn-tv:hover {
  background: var(--color-surface-2);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* ── Image grid ── */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  padding-top: 0;
}

.thumb-card {
  aspect-ratio: 1;
  border-radius: var(--radius);
  overflow: hidden;
  cursor: pointer;
  background: var(--color-surface-2);
  transition: transform 0.2s;
  position: relative;
}
.thumb-card:hover { transform: scale(1.02); }
.thumb-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-desc {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.3rem 0.5rem;
  background: rgba(0,0,0,0.6);
  color: rgba(255,255,255,0.92);
  font-size: 0.7rem;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Thumbnail EXIF pill badges ── */
.thumb-pills {
  position: absolute;
  bottom: 0.4rem;
  left: 0.4rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
  max-width: calc(100% - 0.8rem);
  z-index: 4;
  pointer-events: auto;
}

.thumb-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(6px);
  color: rgba(255, 255, 255, 0.92);
  font-size: 0.65rem;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  border: 1px solid rgba(255,255,255,0.12);
}

.thumb-pill-loc {
  color: #a5f3fc;
  border-color: rgba(165, 243, 252, 0.25);
  background: rgba(0, 50, 80, 0.62);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thumb-pill-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.18);
  color: rgba(255,255,255,0.75);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.15s, color 0.15s;
  pointer-events: auto;
}
.thumb-pill-close:hover {
  background: rgba(220, 50, 50, 0.7);
  color: #fff;
  border-color: rgba(220, 50, 50, 0.5);
}

/* ── Lightbox ── */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.94);
  z-index: 1000;
  display: flex;
  align-items: stretch;
  outline: none;
}

.lb-layout {
  display: flex;
  width: 100%;
  height: 100%;
}

/* Media area */
.lb-media {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.lb-img {
  max-width: 100%;
  max-height: 100vh;
  object-fit: contain;
  display: block;
  user-select: none;
}

.lb-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: rgba(255,255,255,0.15);
  color: #fff;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  z-index: 5;
}
.lb-close:hover { background: rgba(255,255,255,0.3); }

.lb-counter {
  position: absolute;
  bottom: 0.875rem;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255,255,255,0.65);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  background: rgba(0,0,0,0.45);
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  pointer-events: none;
}

/* ── Lightbox EXIF pill badges ── */
.lb-exif-pills {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
  max-width: calc(100% - 2rem);
  z-index: 6;
}

.lb-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  border: 1px solid rgba(255,255,255,0.14);
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.35);
}

.lb-pill-loc {
  color: #7dd3fc;
  border-color: rgba(125, 211, 252, 0.28);
  background: rgba(0, 30, 60, 0.65);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lb-pill-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
}
.lb-pill-close:hover {
  background: rgba(200, 40, 40, 0.75);
  color: #fff;
  border-color: rgba(200, 40, 40, 0.5);
}

.lb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.38);
  color: rgba(255,255,255,0.85);
  border: none;
  border-radius: 8px;
  width: 44px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
  z-index: 4;
  padding: 0;
}
.lb-nav:hover { background: rgba(0,0,0,0.62); }
.lb-nav-prev { left: 0.75rem; }
.lb-nav-next { right: 0.75rem; }

/* ── Info sidebar ── */
.lb-sidebar {
  width: 300px;
  min-width: 300px;
  background: #111;
  border-left: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lb-sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.125rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}

.lb-section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.lb-section-title { gap: 0.35rem; }

.lb-section-label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #555;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  margin-bottom: 0.1rem;
}

.lb-filename {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e5e5e5;
  word-break: break-all;
  line-height: 1.4;
}

.lb-desc {
  font-size: 0.8125rem;
  color: #aaa;
  line-height: 1.5;
}

.lb-download {
  margin-top: 0;
}

.lb-row {
  display: grid;
  grid-template-columns: 2rem 1fr;
  gap: 0.5rem;
  align-items: start;
}

.lb-key {
  display: flex;
  align-items: flex-start;
  padding-top: 1px;
  color: #555;
  font-size: 0.775rem;
  line-height: 1.45;
  white-space: nowrap;
}

.lb-val {
  color: #ccc;
  font-size: 0.8125rem;
  line-height: 1.45;
  word-break: break-word;
}

.lb-maps-link {
  color: #818cf8;
  font-size: 0.775rem;
  text-decoration: none;
}
.lb-maps-link:hover { text-decoration: underline; }

/* ── TV Slideshow ── */
.tv-overlay {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: none;
}

.tv-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.tv-cross-enter-active,
.tv-cross-leave-active { transition: opacity 0.7s ease; }
.tv-cross-enter-from,
.tv-cross-leave-to { opacity: 0; }

.tv-fade-enter-active,
.tv-fade-leave-active { transition: opacity 0.4s ease; }
.tv-fade-enter-from,
.tv-fade-leave-to { opacity: 0; }

.tv-controls {
  position: absolute;
  inset: 0;
  pointer-events: none;
  cursor: default;
}
.tv-controls * { pointer-events: auto; }

.tv-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 1.5rem 2rem 3rem;
  background: linear-gradient(to bottom, rgba(0,0,0,.75) 0%, transparent 100%);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.tv-title { color: #fff; font-size: 1.4rem; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,.6); }
.tv-top-right { display: flex; align-items: center; gap: 1rem; flex-shrink: 0; }
.tv-counter { color: rgba(255,255,255,.85); font-size: 1.1rem; font-variant-numeric: tabular-nums; }

.tv-icon-btn {
  background: rgba(255,255,255,.18);
  color: #fff;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s;
  border: none;
  cursor: pointer;
}
.tv-icon-btn:hover { background: rgba(255,255,255,.35); }

.tv-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,.15);
  color: #fff;
  border-radius: 50%;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  transition: background 0.15s, transform 0.15s;
  cursor: pointer;
}
.tv-nav:hover { background: rgba(255,255,255,.35); transform: translateY(-50%) scale(1.08); }
.tv-prev { left: 1.5rem; }
.tv-next { right: 1.5rem; }

.tv-bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 3rem 2rem 1.75rem;
  background: linear-gradient(to top, rgba(0,0,0,.75) 0%, transparent 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.tv-play-btn {
  background: rgba(255,255,255,.18);
  color: #fff;
  border-radius: 50%;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  transition: background 0.15s;
  cursor: pointer;
}
.tv-play-btn:hover { background: rgba(255,255,255,.35); }
.tv-caption { color: rgba(255,255,255,.8); font-size: 1rem; text-align: center; max-width: 600px; text-shadow: 0 1px 3px rgba(0,0,0,.7); }

/* ── Mobile ── */
@media (max-width: 640px) {
  .lb-layout { flex-direction: column; }
  .lb-media { height: 50dvh; flex: none; }
  .lb-img { max-height: 50dvh; }
  .lb-sidebar {
    width: 100%;
    min-width: 0;
    border-left: none;
    border-top: 1px solid rgba(255,255,255,0.08);
    flex: 1;
    min-height: 0;
  }
  .lb-nav { display: none; }
  .image-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.625rem; }
}
</style>
