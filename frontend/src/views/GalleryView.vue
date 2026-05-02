<template>
  <div class="gallery-page">
    <Navbar />

    <main class="page-wrapper">
      <div class="gallery-header">
        <h2>My Images <span class="count">{{ store.total }}</span></h2>
        <button class="btn-primary" @click="showUpload = true">+ Upload</button>
      </div>

      <div v-if="store.loading" class="loading-grid">
        <div v-for="n in 8" :key="n" class="skeleton" />
      </div>

      <div v-else-if="store.images.length === 0" class="empty-state">
        <p>No images yet. Upload your first one!</p>
        <button class="btn-primary" @click="showUpload = true">Upload image</button>
      </div>

      <div v-else class="image-grid">
        <ImageCard
          v-for="img in store.images"
          :key="img._id"
          :image="img"
          @delete="handleDelete"
          @updated="handleUpdated"
        />
      </div>

      <div v-if="store.pages > 1" class="pagination">
        <button class="btn-ghost" :disabled="store.page <= 1" @click="changePage(store.page - 1)">Previous</button>
        <span>{{ store.page }} / {{ store.pages }}</span>
        <button class="btn-ghost" :disabled="store.page >= store.pages" @click="changePage(store.page + 1)">Next</button>
      </div>
    </main>

    <UploadModal v-if="showUpload" @close="showUpload = false" @uploaded="onUploaded" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useImagesStore } from '../stores/images';
import Navbar from '../components/Navbar.vue';
import ImageCard from '../components/ImageCard.vue';
import UploadModal from '../components/UploadModal.vue';

const store = useImagesStore();
const showUpload = ref(false);

onMounted(() => store.fetchImages());

const changePage = (p) => store.fetchImages(p);

const handleDelete = async (id) => {
  if (!confirm('Delete this image?')) return;
  await store.deleteImage(id);
};

const handleUpdated = () => {};

const onUploaded = () => {
  showUpload.value = false;
};
</script>

<style scoped>
.gallery-page {
  min-height: 100vh;
  background: var(--color-bg);
}

main {
  padding: 2rem 1.5rem;
}

.gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.gallery-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
}

.count {
  font-size: 1rem;
  font-weight: 400;
  color: #6b7280;
  margin-left: 0.5rem;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
}

.loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
}

.skeleton {
  aspect-ratio: 1;
  border-radius: var(--radius);
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.empty-state {
  text-align: center;
  padding: 5rem 1rem;
  color: #6b7280;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  color: #6b7280;
}
</style>
