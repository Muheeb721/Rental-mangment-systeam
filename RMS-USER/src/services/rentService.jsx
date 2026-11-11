import api from './api';

const normalizeRecord = (item = {}) => ({
  id: item._id || item.id || `RENT-${Date.now()}`,
  tenantName: item.tenantName || item.userName || 'RMS Tenant',
  tenantEmail: item.tenantEmail || item.userEmail || item.email || '',
  propertyName: item.propertyName || item.property || 'Property',
  propertyType: item.propertyType || 'Apartment',
  monthlyRent: Number(item.monthlyRent || item.amount || 0),
  paid: Number(item.paid || item.amountPaid || 0),
  remaining: Number(item.remaining || Math.max(0, Number(item.monthlyRent || item.amount || 0) - Number(item.paid || item.amountPaid || 0))),
  dueDate: item.dueDate || new Date().toISOString(),
  month: item.month || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
  status: item.status || 'Pending',
  paymentStatus: item.paymentStatus || item.status || 'Pending',
  createdAt: item.createdAt || new Date().toISOString(),
  ...item,
});

const read = async () => {
  try {
    const response = await api.request('/rents');
    if (response && response.success) {
      return Array.isArray(response.data) ? response.data.map(normalizeRecord) : [];
    }
    return [];
  } catch (error) {
    console.error('Unable to read rent records from backend', error);
    return [];
  }
};

const add = async (record = {}) => {
  try {
    const response = await api.request('/rents', {
      method: 'POST',
      body: record,
    });
    return response && response.success ? normalizeRecord(response.data || record) : null;
  } catch (error) {
    console.error('Unable to create rent record', error);
    return null;
  }
};

const update = async (id, updates = {}) => {
  try {
    const response = await api.request(`/rents/${id}`, {
      method: 'PATCH',
      body: updates,
    });
    return response && response.success ? response.data : null;
  } catch (error) {
    console.error('Unable to update rent record', error);
    return null;
  }
};

const remove = async (id) => {
  try {
    const response = await api.request(`/rents/${id}`, {
      method: 'DELETE',
    });
    return response && response.success ? response.data : null;
  } catch (error) {
    console.error('Unable to delete rent record', error);
    return null;
  }
};

const getMyRentSummary = (user = {}, records = []) => {
  const myRecords = Array.isArray(records) ? records.filter((record) => {
    const email = String(record.tenantEmail || '').toLowerCase();
    const userEmail = String(user.email || '').toLowerCase();
    const userName = String(user.name || '').toLowerCase();
    const tenantName = String(record.tenantName || '').toLowerCase();
    return !userEmail && !userName ? true : email === userEmail || tenantName.includes(userName);
  }) : [];

  const totalMonthly = myRecords.reduce((sum, record) => sum + Number(record.monthlyRent || 0), 0);
  const totalDue = myRecords.reduce((sum, record) => sum + Number(record.remaining || 0), 0);
  const nextDue = [...myRecords].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0] || null;

  return {
    records: myRecords,
    totalMonthly,
    totalDue,
    nextDue,
    count: myRecords.length,
  };
};

export { read, add, update, remove, getMyRentSummary };
export default { read, add, update, remove, getMyRentSummary };
