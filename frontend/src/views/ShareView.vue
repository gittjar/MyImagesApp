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
        <Lock :size="56" class="big-icon" />
        <h2>{{ shareTitle || t('shareView.protectedAlbum') }}</h2>
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
          />
          <p v-if="pinError" class="error-msg">{{ pinError }}</p>
          <button type="submit" class="btn-primary" :disabled="pinLoading">
            {{ pinLoading ? t('shareView.checking') : t('shareView.viewImages') }}
          </button>
        </form>
      </div>
    </div>

    <!-- Gallery -->
    <div v-else-if="state === 'gallery'" class="gallery-wrapper">
      <header class="share-header">
        <div class="share-header-top">
          <h1>{{ shareTitle || t('shareView.sharedAlbum') }}</h1>
          <button v-if="images.length > 1" class="btn-tv" @click="enterTV" :title="t('shareView.tvMode')">
            <Tv :size="18" />
            <span>{{ t('shareView.tvMode') }}</span>
          </button>
        </div>
        <p class="muted">{{ t('shareView.imageCount', images.length) }}</p>
      </header>

      <div class="image-grid page-wrapper">
        <div
          v-for="img in images"
          :key="img._id"
          class="thumb-card"
          @click="lightboxImg = img"
        >
          <img :src="img.url" :alt="img.originalName" loading="lazy" />
        </div>
      </div>
    </div>

    <!-- TV Slideshow -->
    <Teleport to="body">
      <div v-if="tvMode" class="tv-overlay" @click="showTVControlsBriefly">
        <!-- Image with fade transition -->
        <Transition name="tv-cross" mode="out-in">
          <img
            :key="tvIndex"
            :src="images[tvIndex]?.url"
            :alt="images[tvIndex]?.originalName"
            class="tv-img"
          />
        </Transition>

        <!-- Controls (fade in/out) -->
        <Transition name="tv-fade">
          <div v-if="tvShowControls" class="tv-controls">
            <!-- Top bar -->
            <div class="tv-top-bar">
              <span class="tv-title">{{ shareTitle }}</span>
              <div class="tv-top-right">
                <span class="tv-counter">{{ tvIndex + 1 }} / {{ images.length }}</span>
                <button class="tv-icon-btn" @click.stop="exitTV" :title="t('shareView.exitTV')">
                  <X :size="22" />
                </button>
              </div>
            </div>

            <!-- Side nav -->
            <button class="tv-nav tv-prev" @click.stop="tvPrev" :aria-label="t('shareView.prev')">
              <ChevronLeft :size="48" />
            </button>
            <button class="tv-nav tv-next" @click.stop="tvNext" :aria-label="t('shareView.next')">
              <ChevronRight :size="48" />
            </button>

            <!-- Bottom bar -->
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
      <div v-if="lightboxImg" class="lightbox" @click.self="lightboxImg = null">
        <div class="lightbox-inner">
          <img :src="lightboxImg.url" :alt="lightboxImg.originalName" />
          <div class="lb-info">
            <p class="lb-name">{{ lightboxImg.originalName }}</p>
            <p v-if="lightboxImg.description" class="lb-desc">{{ lightboxImg.description }}</p>
          </div>
          <button class="lbclose" @click="lightboxImg = null"><X :size="18" /></button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { XCircle, Lock, X, Tv, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { useRoute } from 'vue-router';
import api from '../services/api';

const { t } = useI18n();
const route = useRoute();
const { userId, slug } = route.params;

const state = ref('loading'); // loading | pin | gallery | error
const shareTitle = ref('');
const images = ref([]);
const pinInput = ref('');
const pinError = ref('');
const pinLoading = ref(false);
const errorMsg = ref('');
const lightboxImg = ref(null);

// TV / Slideshow mode
const tvMode = ref(false);
const tvIndex = ref(0);
const tvPlaying = ref(true);
const tvTimer = ref(null);
const tvShowControls = ref(true);
const tvControlsTimer = ref(null);
const TV_INTERVAL = 5000; // ms per slide

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

function tvJump(i) {
  tvIndex.value = i;
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

    if (data.hasPin) {
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
  images.value = data.images;
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
    pinError.value = err.response?.data?.message || 'Incorrect PIN.';
  } finally {
    pinLoading.value = false;
  }
};
</script>

<style scoped>
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
}

.thumb-card:hover { transform: scale(1.02); }

.thumb-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.88);
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
  gap: 0.75rem;
}

.lightbox-inner img {
  width: 100%;
  max-height: 75vh;
  object-fit: contain;
  border-radius: var(--radius);
}

.lb-info { color: #fff; }
.lb-name { font-weight: 600; }
.lb-desc { font-size: 0.875rem; color: #d1d5db; margin-top: 0.25rem; }

.lbclose {
  position: absolute;
  top: -1rem;
  right: 0;
  background: rgba(255,255,255,.15);
  color: #fff;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .875rem;
  padding: 0;
}

.lbclose:hover { background: rgba(255,255,255,.3); }

/* TV Slideshow */
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

/* Crossfade transition for images */
.tv-cross-enter-active,
.tv-cross-leave-active {
  transition: opacity 0.7s ease;
}
.tv-cross-enter-from,
.tv-cross-leave-to {
  opacity: 0;
}

/* Controls fade transition */
.tv-fade-enter-active,
.tv-fade-leave-active {
  transition: opacity 0.4s ease;
}
.tv-fade-enter-from,
.tv-fade-leave-to {
  opacity: 0;
}

.tv-controls {
  position: absolute;
  inset: 0;
  pointer-events: none;
  cursor: default;
}

.tv-controls * {
  pointer-events: auto;
}

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

.tv-title {
  color: #fff;
  font-size: 1.4rem;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0,0,0,.6);
}

.tv-top-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.tv-counter {
  color: rgba(255,255,255,.85);
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}

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
}

.tv-icon-btn:hover,
.tv-icon-btn:focus {
  background: rgba(255,255,255,.35);
  outline: 2px solid rgba(255,255,255,.5);
}

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
  transition: background 0.15s, transform 0.15s;
}

.tv-nav:hover,
.tv-nav:focus {
  background: rgba(255,255,255,.35);
  transform: translateY(-50%) scale(1.08);
  outline: 2px solid rgba(255,255,255,.5);
}

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
  transition: background 0.15s;
}

.tv-play-btn:hover,
.tv-play-btn:focus {
  background: rgba(255,255,255,.35);
  outline: 2px solid rgba(255,255,255,.5);
}

.tv-caption {
  color: rgba(255,255,255,.8);
  font-size: 1rem;
  text-align: center;
  max-width: 600px;
  text-shadow: 0 1px 3px rgba(0,0,0,.7);
}

/* TV mode button in gallery header */
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
</style>
