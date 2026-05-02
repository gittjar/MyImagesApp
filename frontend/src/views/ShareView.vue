<template>
  <div class="share-page">
    <!-- Loading -->
    <div v-if="state === 'loading'" class="centered">
      <p class="muted">Loading…</p>
    </div>

    <!-- Not found / expired -->
    <div v-else-if="state === 'error'" class="centered">
      <div class="card-simple">
        <p class="big-icon">❌</p>
        <h2>Link not found</h2>
        <p class="muted">{{ errorMsg }}</p>
      </div>
    </div>

    <!-- PIN entry -->
    <div v-else-if="state === 'pin'" class="centered">
      <div class="card-simple">
        <p class="big-icon">🔒</p>
        <h2>{{ shareTitle || 'Protected album' }}</h2>
        <p class="muted">Enter the PIN to view these images.</p>
        <form @submit.prevent="submitPin" class="pin-form">
          <input
            v-model="pinInput"
            type="text"
            inputmode="numeric"
            maxlength="8"
            placeholder="PIN code"
            autofocus
            class="pin-input"
          />
          <p v-if="pinError" class="error-msg">{{ pinError }}</p>
          <button type="submit" class="btn-primary" :disabled="pinLoading">
            {{ pinLoading ? 'Checking…' : 'View images' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Gallery -->
    <div v-else-if="state === 'gallery'" class="gallery-wrapper">
      <header class="share-header">
        <h1>{{ shareTitle || 'Shared album' }}</h1>
        <p class="muted">{{ images.length }} images</p>
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

    <!-- Lightbox -->
    <Teleport to="body">
      <div v-if="lightboxImg" class="lightbox" @click.self="lightboxImg = null">
        <div class="lightbox-inner">
          <img :src="lightboxImg.url" :alt="lightboxImg.originalName" />
          <div class="lb-info">
            <p class="lb-name">{{ lightboxImg.originalName }}</p>
            <p v-if="lightboxImg.description" class="lb-desc">{{ lightboxImg.description }}</p>
          </div>
          <button class="lbclose" @click="lightboxImg = null">✕</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../services/api';

const route = useRoute();
const token = route.params.token;

const state = ref('loading'); // loading | pin | gallery | error
const shareTitle = ref('');
const images = ref([]);
const pinInput = ref('');
const pinError = ref('');
const pinLoading = ref(false);
const errorMsg = ref('');
const lightboxImg = ref(null);

onMounted(async () => {
  try {
    const { data } = await api.get(`/share/${token}`);
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

const loadImages = async (pin = undefined) => {
  const { data } = await api.post(`/share/${token}/images`, pin ? { pin } : {});
  shareTitle.value = data.title || shareTitle.value;
  images.value = data.images;
  state.value = 'gallery';
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
  background: #fff;
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
  background: #e5e7eb;
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
</style>
