import { get, set, del } from 'idb-keyval';

// FIX 2.1: validazione schema minima sui dati letti da IndexedDB
function isValidState(parsed) {
  if (!parsed || typeof parsed !== 'object') { console.warn('Fail 1', parsed); return false; }
  const state = parsed.state ?? parsed;
  if (!state.data) { console.warn('Fail 2', state); return false; }
  const d = state.data;
  if (!d.settings || typeof d.settings !== 'object') { console.warn('Fail 3', d.settings); return false; }
  if (!Array.isArray(d.periods)) { console.warn('Fail 4'); return false; }
  if (!Array.isArray(d.accounts)) { console.warn('Fail 5'); return false; }
  if (!Array.isArray(d.transactions)) { console.warn('Fail 6'); return false; }
  if (!Array.isArray(d.categories)) { console.warn('Fail 7'); return false; }
  if (!Array.isArray(d.goals)) { console.warn('Fail 8'); return false; }
  if (!Array.isArray(d.recurringRules)) { console.warn('Fail 9'); return false; }
  return true;
}

export const idbStorage = {
  getItem: async (name) => {
    try {
      const value = await get(name);
      if (value === undefined || value === null) return null;

      let parsed = value;
      if (typeof value === 'string') {
        try {
          parsed = JSON.parse(value);
        } catch (e) {
          return null;
        }
      }

      if (!isValidState(parsed)) {
        console.warn('[storage] Schema validation failed — dati ignorati, verrà usato initialData');
        return null;
      }

      return typeof value === 'string' ? value : JSON.stringify(value);
    } catch (err) {
      console.warn('[storage] IndexedDB read error:', err);
      return null;
    }
  },

  setItem: async (name, value) => {
    try {
      console.log('[storage] Writing to IndexedDB:', name, 'size:', JSON.stringify(value).length);
      await set(name, value);
      console.log('[storage] ✅ Write successful');
    } catch (err) {
      console.error('[storage] ❌ IndexedDB write error:', err);
    }
  },

  removeItem: async (name) => {
    try {
      await del(name);
    } catch (err) {
      console.warn('[storage] IndexedDB delete error:', err);
    }
  },
};
