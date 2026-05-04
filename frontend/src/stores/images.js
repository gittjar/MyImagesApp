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
  const activeFolder = ref(null); // null = all, 'none' = unfiled, or folderId string

  const fetchImages = async (pageNum = 1, folderFilter = activeFolder.value) => {
    loading.value = true;
    activeFolder.value = folderFilter;
    try {
      const params = { page: pageNum, limit: 20 };
      // null = root view → fetch only images without a folder
      if (folderFilter === null) {
        params.folder = 'none';
      } else if (folderFilter) {
        params.folder = folderFilter;
      }
      const { data } = await api.get('/images', { params });
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
    // Only prepend to current view if it belongs here
    const uploadedFolder = data.image.folder || null;
    const inRoot = activeFolder.value === null && !uploadedFolder;
    const inFolder = activeFolder.value && activeFolder.value === uploadedFolder;
    if (inRoot || inFolder) {
      images.value.unshift(data.image);
      total.value++;
    }
    return data.image;
  };

  const deleteImage = async (id) => {
    await api.delete(`/images/${id}`);
    images.value = images.value.filter((img) => img._id !== id);
    total.value = Math.max(0, total.value - 1);
  };

  const updateImage = async (id, payload) => {
    const { data } = await api.patch(`/images/${id}`, payload);
    const idx = images.value.findIndex((img) => img._id === id);
    if (idx !== -1) images.value[idx] = data.image;
    return data.image;
  };

  const reorderImages = async (ids) => {
    await api.patch('/images/reorder', { ids });
    // Update local order values to match new positions
    ids.forEach((id, i) => {
      const img = images.value.find((img) => img._id === id);
      if (img) img.order = i + 1;
    });
  };

  return { images, total, page, pages, loading, storageUsed, storageQuota, activeFolder, fetchImages, uploadImage, deleteImage, updateImage, reorderImages };
});

