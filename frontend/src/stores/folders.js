import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';

export const useFolderStore = defineStore('folders', () => {
  const folders = ref([]);

  const fetchFolders = async () => {
    const { data } = await api.get('/folders');
    folders.value = data.folders;
  };

  const createFolder = async (name) => {
    const { data } = await api.post('/folders', { name });
    folders.value.push(data.folder);
    folders.value.sort((a, b) => a.name.localeCompare(b.name));
    return data.folder;
  };

  const renameFolder = async (id, name) => {
    const { data } = await api.patch(`/folders/${id}`, { name });
    const idx = folders.value.findIndex((f) => f._id === id);
    if (idx !== -1) folders.value[idx] = { ...folders.value[idx], ...data.folder };
    folders.value.sort((a, b) => a.name.localeCompare(b.name));
  };

  const deleteFolder = async (id) => {
    await api.delete(`/folders/${id}`);
    folders.value = folders.value.filter((f) => f._id !== id);
  };

  const incrementCount = (id) => {
    const f = folders.value.find((f) => f._id === id);
    if (f) f.count = (f.count || 0) + 1;
  };

  return { folders, fetchFolders, createFolder, renameFolder, deleteFolder, incrementCount };
});
