<template>
  <label class="toggle">
    <input
      type="checkbox"
      :checked="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span
      class="track"
      :class="{ on: modelValue }"
      :style="modelValue ? { background: color } : {}"
    ></span>
  </label>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ modelValue: boolean; color?: string }>(), {
  color: "#10b981",
});

const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>();
</script>

<style scoped>
.toggle {
  display: inline-flex;
  cursor: pointer;
  flex-shrink: 0;
}
.toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.track {
  width: 44px;
  height: 24px;
  background: #444;
  border-radius: 12px;
  position: relative;
  transition: background 0.2s;
  display: inline-block;
}
.track::after {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  top: 3px;
  left: 3px;
  transition: left 0.2s;
}
.track.on::after {
  left: 23px;
}
</style>
