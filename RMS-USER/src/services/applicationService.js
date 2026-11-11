import api from './api';

const createApplication = async (payload) => {
  return api.request('/applications', { method: 'POST', body: payload });
};

const listMyApplications = async () => {
  return api.request('/applications/me');
};

const listAll = async () => {
  return api.request('/applications');
};

const accept = async (id) => {
  return api.request(`/applications/${id}/accept`, { method: 'PUT' });
};

const reject = async (id, reason) => {
  return api.request(`/applications/${id}/reject`, { method: 'PUT', body: { reason } });
};

export default {
  createApplication,
  listMyApplications,
  listAll,
  accept,
  reject,
};
