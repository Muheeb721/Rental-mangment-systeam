const PENDING_ACTION_KEY = 'rms_pending_action';

export function normalizePendingAction(value = null) {
  if (!value || typeof value !== 'object') return null;

  const action = typeof value.action === 'string' ? value.action : '';
  if (!action) return null;

  return {
    action,
    propertyId: value.propertyId || '',
    propertyType: value.propertyType || '',
    returnRoute: value.returnRoute || '/',
    propertyTitle: value.propertyTitle || '',
    createdAt: value.createdAt || Date.now(),
  };
}

export function savePendingAction(nextValue) {
  const payload = normalizePendingAction(nextValue);
  if (typeof window === 'undefined' || !payload) return null;

  try {
    window.localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(payload));
    return payload;
  } catch (error) {
    console.warn('Unable to persist pending action', error);
    return null;
  }
}

export function readPendingAction() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(PENDING_ACTION_KEY);
    if (!raw) return null;
    return normalizePendingAction(JSON.parse(raw));
  } catch (error) {
    console.warn('Unable to read pending action', error);
    return null;
  }
}

export function consumePendingAction() {
  const action = readPendingAction();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(PENDING_ACTION_KEY);
    } catch (error) {
      // ignore
    }
  }
  return action;
}

export function buildReturnRouteFromPendingAction(routeFromQuery = '') {
  const pending = readPendingAction();
  const fallback = routeFromQuery && routeFromQuery.startsWith('/') ? routeFromQuery : '/';

  if (pending && pending.returnRoute) {
    return pending.returnRoute;
  }

  return fallback;
}

export function buildPendingAction({ action, propertyId, propertyType, returnRoute, propertyTitle }) {
  return normalizePendingAction({
    action,
    propertyId,
    propertyType,
    returnRoute,
    propertyTitle,
  });
}

export default {
  savePendingAction,
  readPendingAction,
  consumePendingAction,
  buildReturnRouteFromPendingAction,
  buildPendingAction,
};
