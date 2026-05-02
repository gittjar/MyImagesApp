import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';

export const useImagesStore = defineStore('images', () => {
  const images = ref([]);
  const total = ref(0);
  const page = ref(1);
  const pages = ref(1);
  const loading = ref(false);
  const storageUsed = ref(0);
  const storageQuota = ref(1 * 1024 ** 3);

  const fetchImages = async (pageNum = 1) => {
    loading.value = true;
    try {
      const { data } = await api.get('/images', { params: { page: pageNum, limit: 20 } });
      images.value = data.images;
      total.value = data.total;
      page.value = data.page;
      pages.value = data.pages;
      storageUsed.value = data.storageUsed ?? storageUsed.value;
      storageQuota.value = data.storageQuota ?? storageQuota.value;
    } finally {
      loading.value = false;
    }
  };

  const uploadImage = async (formData) => {
    const { data } = await api.post('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    images.value.unshift(data.image);
    total.value++;
    return data.image;
  };

  const deleteImage = async (id) => {
    await api.delete(`/images/${id}`);
    images.value = images.value.filter((img) => img._id !== id);
    total.value--;
  };

  const updateImage = async (id, payload) => {
    const { data } = await api.patch(`/images/${id}`, payload);
    const idx = images.value.findIndex((img) => img._id === id);
    if (idx !== -1) images.value[idx] = data.image;
    return data.image;
  };

  return { images, total, page, pages, loading, storageUsed, storageQuota, fetchImages, uploadImage, deleteImage, updateImage };
});
