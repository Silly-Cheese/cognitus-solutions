import { onAuthStateChange, logout } from "../services/authService.js";

export const accountStore = {
  ready: false,
  user: null,
  record: null,
  loading: true
};

const listeners = new Set();
let unsubscribeAccount = null;

export async function startAccountStore() {
  if (unsubscribeAccount) return;

  unsubscribeAccount = await onAuthStateChange((nextState) => {
    accountStore.ready = nextState.firebaseReady;
    accountStore.user = nextState.authUser;
    accountStore.record = nextState.userRecord;
    accountStore.loading = false;
    notifyAccountListeners();
  });
}

export function subscribeAccountStore(listener) {
  listeners.add(listener);
  listener({ ...accountStore });

  return () => listeners.delete(listener);
}

export function getAccountStore() {
  return { ...accountStore };
}

export function hasAccount() {
  return Boolean(accountStore.user && accountStore.record);
}

export async function signOutCurrentUser() {
  await logout();
}

function notifyAccountListeners() {
  const snapshot = { ...accountStore };
  listeners.forEach((listener) => listener(snapshot));
}
