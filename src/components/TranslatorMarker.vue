<template>
  <button
    type="button"
    class="translator-marker"
    :class="{
      'is-dark': dark,
      'is-active': active,
      'is-editing': editing,
      'is-outbox': outbox,
      'is-translated': translated,
      'is-proofread': proofread,
      'is-dragging': dragging,
    }"
    :style="rootStyle"
    :aria-label="ariaLabel"
    @click.stop="emit('select')"
    @contextmenu.prevent.stop="emit('request-remove')"
    @mousedown.stop="handleMouseDown"
  >
    <span class="translator-marker__surface">
      <span class="translator-marker__label" :style="labelStyle">
        {{ index }}
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

interface Props {
  index: number | string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  active?: boolean;
  editing?: boolean;
  outbox?: boolean;
  translated?: boolean;
  proofread?: boolean;
  dragging?: boolean;
  dark?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  editing: false,
  outbox: false,
  translated: false,
  proofread: false,
  dragging: false,
  dark: false,
});

const emit = defineEmits<{
  (event: "select"): void;
  (event: "request-remove"): void;
  (event: "drag-start", mouseEvent: MouseEvent): void;
}>();

const resolvedSize = computed(() => {
  return typeof props.size === "number" && isFinite(props.size)
    ? props.size
    : 28;
});

const resolvedOpacity = computed(() => {
  return typeof props.opacity === "number" && isFinite(props.opacity)
    ? props.opacity
    : 0.85;
});

const rootStyle = computed<CSSProperties>(() => ({
  left: `${props.x * 100}%`,
  top: `${props.y * 100}%`,
  width: `${resolvedSize.value}px`,
  height: `${resolvedSize.value}px`,
  minWidth: `${resolvedSize.value}px`,
  maxWidth: `${resolvedSize.value}px`,
  minHeight: `${resolvedSize.value}px`,
  maxHeight: `${resolvedSize.value}px`,
  aspectRatio: "1 / 1",
  opacity: props.dragging ? 0.8 : resolvedOpacity.value,
}));

const labelStyle = computed<CSSProperties>(() => ({
  fontSize: `${Math.max(9, Math.round(resolvedSize.value * 0.4))}px`,
}));

const ariaLabel = computed(() => `Marker ${props.index}`);

function handleMouseDown(mouseEvent: MouseEvent): void {
  emit("drag-start", mouseEvent);
}
</script>

<style scoped lang="scss">
.translator-marker {
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  transform: translate(-50%, -50%);
  cursor: pointer;
  user-select: none;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  z-index: 10;
  aspect-ratio: 1 / 1;
  min-width: 0;
  min-height: 0;
  line-height: 0;
  font-size: 0;
}

.translator-marker__surface {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  min-width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  aspect-ratio: 1 / 1;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  background: linear-gradient(135deg, #f9a8d4, #f472b6);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  color: #fff;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  transform-origin: center center;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  pointer-events: none;
}

.translator-marker__label {
  display: block;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.translator-marker.is-outbox .translator-marker__surface {
  background: linear-gradient(135deg, #fde047, #facc15);
}

.translator-marker.is-translated .translator-marker__surface {
  border-color: #fb923c;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.25),
    0 0 0 2px rgba(251, 146, 60, 0.3);
}

.translator-marker.is-proofread .translator-marker__surface {
  border-color: #4ade80;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.25),
    0 0 0 2px rgba(74, 222, 128, 0.3);
}

.translator-marker:hover {
  z-index: 20;
}

.translator-marker:hover .translator-marker__surface {
  transform: scale(1.18);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.4),
    0 0 0 3px rgba(255, 255, 255, 0.3);
}

.translator-marker.is-active {
  z-index: 30;
}

.translator-marker.is-active .translator-marker__surface {
  border-color: var(--control-btn-primary-border, #9b73f2);
  transform: scale(1.08);
  box-shadow:
    0 4px 12px
      color-mix(
        in srgb,
        var(--control-btn-primary-border, #9b73f2) 45%,
        transparent
      ),
    0 0 0 2px
      color-mix(
        in srgb,
        var(--control-btn-primary-border, #9b73f2) 24%,
        transparent
      );
}

.translator-marker.is-editing {
  z-index: 31;
}

.translator-marker.is-editing .translator-marker__surface {
  border-color: #22c55e;
  transform: scale(1.08);
  box-shadow:
    0 4px 12px rgba(34, 197, 94, 0.32),
    0 0 0 2px rgba(34, 197, 94, 0.18);
}

.translator-marker.is-dragging {
  z-index: 40;
  cursor: grabbing;
}

.translator-marker.is-dragging .translator-marker__surface {
  transition: none;
}

.translator-marker.is-dark .translator-marker__surface {
  background: linear-gradient(135deg, #c084fc, #a855f7);
}

.translator-marker.is-dark.is-outbox .translator-marker__surface {
  background: linear-gradient(135deg, #fbbf24, #d97706);
}

.translator-marker.is-dark.is-proofread .translator-marker__surface {
  background: linear-gradient(135deg, #34d399, #059669);
}
</style>
