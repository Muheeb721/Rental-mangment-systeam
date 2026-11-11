import apiClient from '../services/apiClient';

const getSessionUser = () => {
  if (typeof window === 'undefined') return null;
  return window.__rms_inmemory_session || window.__rms_inmemory_auth || window.__rms_inmemory_user || null;
};

const getToken = () => {
  if (typeof window === 'undefined') return '';
  return window.__RMS_AUTH_TOKEN || window.__rms_inmemory_token || '';
};

export const recordAdminAction = async ({
  actionType,
  entityType,
  entityId,
  userId,
  userName,
  propertyName,
  previousStatus,
  newStatus,
  message,
  reason,
  description,
}) => {
  const user = getSessionUser();
  const token = getToken();
  const payload = {
    adminId: user?.id || 'admin-demo',
    adminName: user?.name || 'Admin',
    adminEmail: user?.email || 'admin@rms.local',
    userId: userId || '',
    userName: userName || '',
    actionType,
    entityType,
    entityId: String(entityId || ''),
    previousStatus: previousStatus || '',
    newStatus: newStatus || '',
    propertyName: propertyName || '',
    message: message || '',
    reason: reason || '',
    description: description || message || '',
  };

  if (!token && !user) {
    return { success: false, skipped: true, payload };
  }

  try {
    const res = await apiClient.post('/admin/activity', payload);
    return res?.data?.success ? { success: true, data: res.data.data, notification: res.data.notification } : { success: false, skipped: true, payload };
  } catch (error) {
    console.warn('Admin activity backend sync unavailable:', error);
    return { success: false, skipped: true, payload };
  }
};

export const getMyActivity = async () => {
  try {
    const res = await apiClient.get('/users/me/activity');
    return res?.data?.success ? { success: true, data: res.data.data || [] } : { success: false, data: [] };
  } catch (error) {
    console.warn('User activity retrieval unavailable:', error);
    return { success: false, data: [] };
  }
};
