import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const token = ref(localStorage.getItem('token') || null);

  const isAuthenticated = computed(() => !!token.value && !!user.value);

  const setAuth = (newToken, newUser) => {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem('token', newToken);
  };

  const fetchMe = async () => {
    if (!token.value) return;
    try {
      const { data } = await api.get('/auth/me');
      user.value = data.user;
    } catch {
      logout();
    }
  };

  const login = async (identifier, password) => {
    const { data } = await api.post('/auth/login', { identifier, password });
    setAuth(data.token, data.user);
  };

  const register = async (name, email, password, username) => {
    const { data } = await api.post('/auth/register', { name, email, password, username: username || undefined });
    setAuth(data.token, data.user);
  };

  const loginWithGoogle = () => {
    window.location.href = '/api/auth/google';
  };

  const logout = () => {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
  };

  return { user, token, isAuthenticated, fetchMe, login, register, loginWithGoogle, logout };
});
