import { useEffect, useState } from 'react';
import { getPlaces } from '../services/locationService';

let snapshot = null;

/** All Lahore areas + landmarks (from /api/places, or the offline fallback). */
export function usePlaces() {
  const [places, setPlaces] = useState(() => snapshot || []);
  useEffect(() => {
    let active = true;
    getPlaces().then((list) => { snapshot = list; if (active) setPlaces(list); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return places;
}

export default usePlaces;
