import { ref } from 'vue';

// Module-level singleton — all components share the same state
const state = ref(null);
// state shape: { title?, message, confirmLabel?, cancelLabel?, danger?, resolve }

export function useConfirm() {
  const ask = ({ title = '', message = '', confirmLabel = '', cancelLabel = '', danger = false } = {}) =>
    new Promise((resolve) => {
      state.value = { title, message, confirmLabel, cancelLabel, danger, resolve };
    });

  const handleConfirm = () => { state.value?.resolve(true);  state.value = null; };
  const handleCancel  = () => { state.value?.resolve(false); state.value = null; };

  return { confirmState: state, ask, handleConfirm, handleCancel };
}
