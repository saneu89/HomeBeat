import { useSyncExternalStore } from 'react';

/** Kurze Hinweise („Toast“) – auch aus Diensten ohne UI heraus nutzbar. */
let message: { id: number; text: string } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let counter = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const toast = {
  show(text: string, durationMs = 2600) {
    message = { id: ++counter, text };
    clearTimeout(timer);
    timer = setTimeout(() => {
      message = null;
      emit();
    }, durationMs);
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => message,
};

export function useToastMessage() {
  return useSyncExternalStore(toast.subscribe, toast.get);
}
