import { useEffect, useMemo, useState } from 'react';
import { useProperties } from './useProperties';
import { usePlaces } from './usePlaces';
import { getAreas, propertyInArea } from '../services/locationService';

const SITE_PHOTOS = ['/images/site/house-exterior-09.jpg', '/images/site/house-exterior-06.jpg', '/images/site/apartment-building-02.jpg', '/images/site/house-exterior-12.jpg'];
export const fallbackPhoto = (slug = '') => SITE_PHOTOS[[...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % SITE_PHOTOS.length];

/** All Lahore areas with stats + a cover photo from a listing in that area. */
export function useAreas() {
  const { items, loading: propsLoading } = useProperties();
  const places = usePlaces();
  const [state, setState] = useState({ areas: [], loading: true });
  const listed = useMemo(() => items.filter((p) => p.listed), [items]);

  useEffect(() => {
    if (propsLoading) return undefined;
    let active = true;
    getAreas(listed).then((areas) => { if (active) setState({ areas, loading: false }); }).catch(() => { if (active) setState({ areas: [], loading: false }); });
    return () => { active = false; };
  }, [listed, propsLoading]);

  const areas = useMemo(() => state.areas.map((a) => {
    const withCover = a.image ? null : listed.find((p) => p.cover && propertyInArea(p, a, places));
    return { ...a, cover: a.image || withCover?.cover || fallbackPhoto(a.slug) };
  }), [state.areas, listed, places]);

  return { areas, loading: state.loading || propsLoading, items: listed, places };
}
