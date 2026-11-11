import api from './api';

const normalizeRequest = (item = {}) => ({
  id: item._id || item.id || `MT-${Date.now()}`,
  tenantName: item.tenantName || item.userName || 'RMS Tenant',
  tenantEmail: item.tenantEmail || item.userEmail || item.email || '',
  propertyName: item.propertyName || item.property || 'Property',
  propertyType: item.propertyType || 'Apartment',
  category: item.category || 'General',
  priority: item.priority || 'Medium',
  issue: item.issue || item.description || 'Maintenance issue reported.',
  status: item.status || 'Open',
  createdAt: item.createdAt || new Date().toISOString(),
  dueDate: item.dueDate || new Date(Date.now() + 86400000 * 3).toISOString(),
  ...item,
});

const read = async () => {
  try {
    const response = await api.request('/maintenance');
    if (response && response.success) {
      return Array.isArray(response.data) ? response.data.map(normalizeRequest) : [];
    }
    return [];
  } catch (error) {
    console.error('Unable to read maintenance requests from backend', error);
    return [];
  }
};

const add = async (request = {}) => {
  try {
    const response = await api.request('/maintenance', {
      method: 'POST',
      body: request,
    });
    return response && response.success ? normalizeRequest(response.data || request) : null;
  } catch (error) {
    console.error('Unable to create maintenance request', error);
    return null;
  }
};

const update = async (id, updates = {}) => {
  try {
    const response = await api.request(`/maintenance/${id}`, {
      method: 'PATCH',
      body: updates,
    });
    return response && response.success ? response.data : null;
  } catch (error) {
    console.error('Unable to update maintenance request', error);
    return null;
  }
};

const remove = async (id) => {
  try {
    const response = await api.request(`/maintenance/${id}`, {
      method: 'DELETE',
    });
    return response && response.success ? response.data : null;
  } catch (error) {
    console.error('Unable to delete maintenance request', error);
    return null;
  }
};

const getSummary = (records = []) => ({
  total: records.length,
  open: records.filter((item) => item.status === 'Open').length,
  inProgress: records.filter((item) => item.status === 'In Progress').length,
  resolved: records.filter((item) => item.status === 'Resolved').length,
});

export { read, add, update, remove, getSummary };
export default { read, add, update, remove, getSummary };
