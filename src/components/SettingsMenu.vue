<template>
  <button
    class="trigger"
    title="Settings"
    @click="settingsStore.setSettingsVisible(true)"
  >
    <span class="trigger-icon" :style="{ '--icon': `url(${iconSettings})` }"></span>
  </button>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../stores/settings';
import iconSettings from '../assets/icons/icons8-settings-100.png';

const settingsStore = useSettingsStore();
</script>

<style scoped>
.trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0.3rem 0.4rem;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-color);
  transition: background 0.15s, color 0.15s, transform 0.1s;
}

.trigger:hover {
  background: var(--btn-hover);
  color: var(--accent-color);
}

.trigger-icon {
  width: 15px;
  height: 15px;
  background-color: currentColor;
  -webkit-mask: var(--icon) center / contain no-repeat;
  mask: var(--icon) center / contain no-repeat;
  transition: transform 0.15s;
}

.trigger:hover .trigger-icon { transform: scale(1.1); }
.trigger:active { transform: scale(0.94); }
</style>
