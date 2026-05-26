import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true }
  },
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: () => import('../views/AuthCallback.vue')
  },
  {
    path: '/',
    name: 'Gallery',
    component: () => import('../views/GalleryView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/AdminView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/shares',
    name: 'MyShares',
    component: () => import('../views/MySharesView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/share/:userId/:slug',
    name: 'Share',
    component: () => import('../views/ShareView.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (auth.token && !auth.user) {
    await auth.fetchMe();
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'Login' };
  }

  if (to.meta.requiresAdmin && !['admin', 'subadmin'].includes(auth.user?.role)) {
    return { name: 'Gallery' };
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'Gallery' };
  }
});

export default router;
