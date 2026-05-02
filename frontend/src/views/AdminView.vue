<template>
  <div class="admin-page">
    <Navbar />
    <main class="page-wrapper">
      <div class="admin-header">
        <h2>Admin Panel</h2>
      </div>

      <!-- Stats -->
      <div v-if="stats" class="stats-row">
        <div class="stat-card">
          <p class="stat-value">{{ stats.totalUsers }}</p>
          <p class="stat-label">Users</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">{{ stats.totalImages }}</p>
          <p class="stat-label">Images</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">{{ formatBytes(stats.totalStorageUsed) }}</p>
          <p class="stat-label">Total storage used</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">{{ stats.subadminCount }} / {{ stats.maxSubadmins }}</p>
          <p class="stat-label">Subadmins</p>
        </div>
      </div>

      <!-- Users table -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Images</th>
              <th>Storage used</th>
              <th>Quota</th>
              <th>Status</th>
              <th>Last login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user._id">
              <td>
                <div class="user-cell">
                  <img v-if="user.avatar" :src="user.avatar" class="mini-avatar" />
                  {{ user.name }}
                </div>
              </td>
              <td class="muted">{{ user.email }}</td>
              <td>
                <span :class="['badge', roleBadgeClass(user.role)]">
                  {{ user.role }}
                </span>
              </td>
              <td>{{ user.imageCount }}</td>
              <td>{{ formatBytes(user.storageUsed) }}</td>
              <td>
                <input
                  v-if="editingQuota === user._id"
                  :value="quotaInputGB"
                  @input="quotaInputGB = $event.target.value"
                  type="number"
                  min="0.1"
                  step="0.5"
                  class="quota-input"
                />
                <span v-else>{{ formatBytes(user.storageQuota) }}</span>
              </td>
              <td>
                <span :class="['badge', user.isActive ? 'badge-active' : 'badge-inactive']">
                  {{ user.isActive ? 'Active' : 'Disabled' }}
                </span>
              </td>
              <td class="muted">{{ user.lastLoginAt ? formatDate(user.lastLoginAt) : '—' }}</td>
              <td>
                <div class="action-btns">
                  <template v-if="editingQuota === user._id">
                    <button class="btn-primary btn-xs" @click="saveQuota(user)">Save</button>
                    <button class="btn-ghost btn-xs" @click="editingQuota = null">Cancel</button>
                  </template>
                  <template v-else>
                    <button
                      v-if="canEditUser(user)"
                      class="btn-ghost btn-xs"
                      @click="startEditQuota(user)"
                      title="Edit quota"
                    ><HardDrive :size="14" /></button>
                    <button
                      v-if="canEditUser(user)"
                      class="btn-ghost btn-xs"
                      @click="toggleActive(user)"
                      :title="user.isActive ? 'Disable' : 'Enable'"
                    >
                      <component :is="user.isActive ? Lock : LockOpen" :size="14" />
                    </button>
                    <button
                      v-if="isSuperAdmin && user.role === 'user'"
                      class="btn-ghost btn-xs"
                      @click="setRole(user, 'subadmin')"
                      :disabled="stats && stats.subadminCount >= stats.maxSubadmins"
                      title="Promote to subadmin"
                    ><ChevronsUp :size="14" /></button>
                    <button
                      v-if="isSuperAdmin && user.role === 'subadmin'"
                      class="btn-ghost btn-xs"
                      @click="setRole(user, 'user')"
                      title="Demote to user"
                    ><ChevronsDown :size="14" /></button>
                    <button
                      v-if="isSuperAdmin && user._id !== currentUserId && user.role !== 'admin'"
                      class="btn-danger btn-xs"
                      @click="removeUser(user)"
                      title="Delete user"
                    ><Trash2 :size="14" /></button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="pages > 1" class="pagination">
        <button class="btn-ghost" :disabled="page <= 1" @click="loadPage(page - 1)">Previous</button>
        <span>{{ page }} / {{ pages }}</span>
        <button class="btn-ghost" :disabled="page >= pages" @click="loadPage(page + 1)">Next</button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { HardDrive, Lock, LockOpen, ChevronsUp, ChevronsDown, Trash2 } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import Navbar from '../components/Navbar.vue';
import api from '../services/api';

const auth = useAuthStore();
const currentUserId = computed(() => auth.user?.id);
const isSuperAdmin = computed(() => auth.user?.role === 'admin');

const canEditUser = (user) => {
  if (isSuperAdmin.value) return user._id !== currentUserId.value || true;
  // subadmin: can only edit regular users
  return user.role === 'user';
};

const roleBadgeClass = (role) => {
  if (role === 'admin') return 'badge-admin';
  if (role === 'subadmin') return 'badge-subadmin';
  return 'badge-user';
};

const users = ref([]);
const stats = ref(null);
const page = ref(1);
const pages = ref(1);
const editingQuota = ref(null);
const quotaInputGB = ref(1);

onMounted(async () => {
  await Promise.all([loadPage(1), loadStats()]);
});

const loadPage = async (p) => {
  const { data } = await api.get('/admin/users', { params: { page: p, limit: 50 } });
  users.value = data.users;
  page.value = data.page;
  pages.value = data.pages;
  if (stats.value) stats.value.subadminCount = data.subadminCount;
};

const loadStats = async () => {
  const { data } = await api.get('/admin/stats');
  stats.value = data;
};

const startEditQuota = (user) => {
  editingQuota.value = user._id;
  quotaInputGB.value = +(user.storageQuota / (1024 ** 3)).toFixed(2);
};

const saveQuota = async (user) => {
  const bytes = Math.round(parseFloat(quotaInputGB.value) * 1024 ** 3);
  await api.patch(`/admin/users/${user._id}`, { storageQuota: bytes });
  user.storageQuota = bytes;
  editingQuota.value = null;
};

const toggleActive = async (user) => {
  const { data } = await api.patch(`/admin/users/${user._id}`, { isActive: !user.isActive });
  user.isActive = data.user.isActive;
};

const setRole = async (user, newRole) => {
  const label = newRole === 'subadmin' ? 'promote to subadmin' : 'demote to user';
  if (!confirm(`${label} ${user.email}?`)) return;
  const { data } = await api.patch(`/admin/users/${user._id}`, { role: newRole });
  user.role = data.user.role;
  // refresh subadmin count
  await Promise.all([loadPage(page.value), loadStats()]);
};

const removeUser = async (user) => {
  if (!confirm(`Delete user ${user.email} and all their images?`)) return;
  await api.delete(`/admin/users/${user._id}`);
  users.value = users.value.filter((u) => u._id !== user._id);
  if (stats.value) stats.value.totalUsers--;
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-FI', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
</script>

<style scoped>
.admin-page { min-height: 100vh; background: var(--color-bg); }

main { padding: 2rem 1.5rem; }

.admin-header { margin-bottom: 1.5rem; }
.admin-header h2 { font-size: 1.5rem; font-weight: 700; }

.stats-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.stat-card {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.25rem 1.75rem;
  min-width: 140px;
}

.stat-value { font-size: 1.75rem; font-weight: 700; color: var(--color-primary); }
.stat-label { font-size: 0.8125rem; color: var(--color-muted); margin-top: 0.25rem; }

.table-wrap {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow-x: auto;
}

table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }

th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--color-surface-2); }

.user-cell { display: flex; align-items: center; gap: 0.5rem; }

.mini-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
}

.muted { color: var(--color-muted); font-size: 0.8125rem; }

.badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-admin { background: color-mix(in srgb, #818cf8 20%, transparent); color: #a78bfa; }
.badge-subadmin { background: color-mix(in srgb, #f59e0b 20%, transparent); color: #f59e0b; }
.badge-user { background: var(--color-surface-2); color: var(--color-muted); }
.badge-active { background: color-mix(in srgb, #34d399 20%, transparent); color: #34d399; }
.badge-inactive { background: color-mix(in srgb, #f87171 20%, transparent); color: #f87171; }

.quota-input {
  width: 70px;
  padding: 0.25rem 0.375rem;
  font-size: 0.8125rem;
}

.action-btns { display: flex; gap: 0.375rem; }

.btn-xs {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
  color: var(--color-muted);
}
</style>
