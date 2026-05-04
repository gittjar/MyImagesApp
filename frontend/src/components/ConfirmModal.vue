<template>
  <Teleport to="body">
    <div
      v-if="confirmState"
      class="confirm-overlay"
      @click.self="handleCancel"
      @keydown.esc="handleCancel"
      tabindex="-1"
    >
      <div class="confirm-dialog" role="alertdialog" aria-modal="true">
        <p v-if="confirmState.title" class="confirm-title">{{ confirmState.title }}</p>
        <p class="confirm-message">{{ confirmState.message }}</p>
        <div class="confirm-actions">
          <button class="btn-ghost" @click="handleCancel">
            {{ confirmState.cancelLabel || t('confirm.cancel') }}
          </button>
          <button
            :class="['btn-primary', { 'btn-danger-solid': confirmState.danger }]"
            @click="handleConfirm"
            autofocus
          >
            {{ confirmState.confirmLabel || t('confirm.ok') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useConfirm } from '../composables/useConfirm';

const { t } = useI18n();
const { confirmState, handleConfirm, handleCancel } = useConfirm();
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  padding: 1rem;
}

.confirm-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem 1.75rem;
  width: 100%;
  max-width: 380px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.confirm-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.confirm-message {
  font-size: 0.9rem;
  color: var(--color-muted);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  margin-top: 0.25rem;
}

.btn-danger-solid {
  background: var(--color-danger) !important;
  border-color: var(--color-danger) !important;
  color: #fff !important;
}
.btn-danger-solid:hover {
  opacity: 0.88;
}
</style>
