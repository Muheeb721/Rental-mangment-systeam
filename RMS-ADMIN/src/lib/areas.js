import { useEffect, useState } from 'react';
import { api } from './api';

let areaCache = null;
/** All Lahore areas from /api/places?type=area (cached for the session). */
export function useLahoreAreas() {
  const [state, setState] = useState({ areas: areaCache || [], error: '' });
  useEffect(() => {
    if (areaCache) return undefined;
    let active = true;
    api.get('/places', { type: 'area', limit: 1000 })
      .then((res) => {
        const list = (Array.isArray(res?.data) ? res.data : []).map((a) => ({
          ...a,
          lat: Number(a.lat ?? a.latitude ?? a.center?.lat),
          lng: Number(a.lng ?? a.longitude ?? a.center?.lng),
          parent: a.parent && typeof a.parent === 'object' ? a.parent.slug : a.parent || '',
        }));
        areaCache = list;
        if (active) setState({ areas: list, error: '' });
      })
      .catch((e) => { if (active) setState({ areas: [], error: e?.message || 'Areas unavailable' }); });
    return () => { active = false; };
  }, []);
  return state;
}

const SOCIETY_SHORT = { 'dha-lahore': 'DHA', askari: 'Askari' };

/** Maps a picked area to the form's society / phase / coordinates. */
export function areaToLocation(area, areas) {
  const parent = area.parent ? areas.find((a) => a.slug === area.parent) : null;
  return {
    areaSlug: area.slug,
    society: parent ? (SOCIETY_SHORT[parent.slug] || parent.name) : (SOCIETY_SHORT[area.slug] || area.name),
    phase: parent ? area.name : '',
    ...(Number.isFinite(area.lat) && Number.isFinite(area.lng) ? { latitude: Number(area.lat.toFixed(6)), longitude: Number(area.lng.toFixed(6)) } : {}),
  };
}

