import { useSyncExternalStore } from "react";

type Listener = () => void;

let pendingCount = 0;
const listeners = new Set<Listener>();

export function getPendingCount() {
  return pendingCount;
}

export function incrementPending() {
  pendingCount++;
  notifyListeners();
}

export function decrementPending() {
  if (pendingCount > 0) {
    pendingCount--;
    notifyListeners();
  }
}

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePendingCount() {
  return useSyncExternalStore(subscribe, getPendingCount, getPendingCount);
}
