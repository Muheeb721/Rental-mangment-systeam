import { useCallback, useEffect, useState } from 'react';
import { listProperties, getPropertyById } from '../services/propertyService';
import { normalizeProperty } from '../utils/property';

let cache = null;
let cacheAt = 0;
let inflight = null;
const TTL = 60 * 1000;

const unwrapList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.properties)) return res.properties;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  return null;
};

export async function fetchAllProperties({ force = false } = {}) {
  if (!force && cache && Date.now() - cacheAt < TTL) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await listProperties({ limit: 500 });
    const list = unwrapList(res);
    if (!list) {
      inflight = null;
      throw new Error(res?.message || 'Unable to load properties');
    }
    cache = list.map(normalizeProperty).filter((p) => p.id);
    cacheAt = Date.now();
    inflight = null;
    return cache;
  })();
  return inflight;
}

export function useProperties() {
  const [state, setState] = useState(() => ({ items: cache || [], loading: !cache, error: '' }));

  const load = useCallback(async (force = false) => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const items = await fetchAllProperties({ force });
      setState({ items, loading: false, error: '' });
    } catch (e) {
      setState({ items: [], loading: false, error: e?.message || 'Unable to load properties' });
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAllProperties()
      .then((items) => { if (active) setState({ items, loading: false, error: '' }); })
      .catch((e) => { if (active) setState({ items: [], loading: false, error: e?.message || 'Unable to load properties' }); });
    return () => { active = false; };
  }, []);

  return { ...state, reload: () => load(true) };
}

export function useProperty(id) {
  const [state, setState] = useState({ item: null, loading: true, error: '' });

  useEffect(() => {
    let active = true;
    setState({ item: cache?.find((p) => p.id === id) || null, loading: true, error: '' });
    getPropertyById(id).then((res) => {
      if (!active) return;
      const raw = res?.data && !Array.isArray(res.data) ? res.data : res?.property || (res?._id ? res : null);
      if (raw && (raw._id || raw.id)) setState({ item: normalizeProperty(raw), loading: false, error: '' });
      else setState({ item: null, loading: false, error: res?.status === 404 || res?.success === false ? 'not-found' : 'error' });
    });
    return () => { active = false; };
  }, [id]);

  return state;
}
