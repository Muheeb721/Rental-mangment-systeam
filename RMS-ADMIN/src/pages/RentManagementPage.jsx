import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './RentManagementPage.css';
import Modal from '../components/Modal';
import {
  generateRentRecordId,
  generateReminderId,
  calculateRentStatus,
} from '../services/localStorage';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import { apiService } from '../services/api';

const defaultSettings = {
  defaultDueDay: 10,
  gracePeriod: 0,
  lateFeeFixed: 0,
  lateFeePercent: 0,
  reminderDays: [7, 3, 1],
  autoGenerate: false,
  currency: 'PKR',
};

const normalizeTenant = (tenant, index) => ({
  ...tenant,
  id: tenant._id || tenant.id || `tenant-${index + 1}`,
  _id: tenant._id || tenant.id || `tenant-${index + 1}`,
  fullName: tenant.fullName || tenant.name || 'Unknown Tenant',
  name: tenant.name || tenant.fullName || 'Unknown Tenant',
  email: tenant.email || '',
  phone: tenant.phone || '',
  status: tenant.status || 'Active',
  propertyName: tenant.propertyName || tenant.property || '',
  propertyId: tenant.propertyId || '',
  monthlyRent: tenant.monthlyRent || tenant.rent || 0,
});

const normalizeRentRecord = (record, index) => ({
  ...record,
  id: record._id || record.id || `rent-${index + 1}`,
  _id: record._id || record.id || `rent-${index + 1}`,
  tenantId: record.userId || record.tenantId || '',
  tenantName: record.userName || record.tenantName || 'Unknown Tenant',
  propertyId: record.propertyId || '',
  propertyName: record.propertyName || '',
  amount: Number(record.amount || record.monthlyRent || 0),
  paidAmount: Number(record.paid || record.paidAmount || 0),
  remainingAmount: Number(record.remaining ?? record.remainingAmount ?? Math.max((Number(record.amount || record.monthlyRent || 0) - Number(record.paid || record.paidAmount || 0)), 0)),
  dueDate: record.dueDate || new Date().toISOString(),
  status: record.status || 'Pending',
});

function RentManagementPage({ appData, setAppData, notify }) {
  const tenants = appData.tenants || [];
  const rentRecords = appData.rentRecords || [];
  const rentPayments = appData.rentPayments || [];
  const settings = appData.rentSettings || defaultSettings;
  const navigate = useNavigate();

  const [tab, setTab] = useState('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const [editTenant, setEditTenant] = useState(null);
  const [tenantForm, setTenantForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    cnic: '',
    propertyId: '',
    propertyName: '',
    unit: '',
    monthlyRent: '',
    securityDeposit: '',
    leaseStart: '',
    leaseEnd: '',
    dueDay: settings.defaultDueDay || 10,
    status: 'Active',
  });

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ rentId: '', amount: '', method: 'Cash', transactionId: '', date: '', notes: '' });

  useEffect(() => {
    // ensure settings exist in appData
    if (!appData.rentSettings) {
      setAppData((prev) => ({ ...prev, rentSettings: defaultSettings }));
    }
    // auto generate this month's rent if enabled
    if ((appData.rentSettings && appData.rentSettings.autoGenerate) || defaultSettings.autoGenerate) {
      generateMonthlyRent(new Date());
    }
    // run reminder sweep on load
    runReminderSweep();
  }, []);

  useEffect(() => {
    const loadTenantsAndPayments = async () => {
      try {
        let nextTenants = appData.tenants || [];
        if (!(appData.tenants || []).length) {
          const resp = await apiService.request('/admin/users');
          if (resp?.success) {
            const backendUsers = Array.isArray(resp.data) ? resp.data : [];
            const tenantCandidates = backendUsers.filter((user) =>
              String(user.role || '').toLowerCase() === 'tenant' ||
              String(user.role || '').toLowerCase() === 'resident' ||
              (user.profile && user.profile.tenant)
            );
            nextTenants = (tenantCandidates.length ? tenantCandidates : backendUsers).map(normalizeTenant);
          }
        }

        let nextPayments = appData.rentPayments || [];
        if (!(appData.rentPayments || []).length) {
          const payResp = await apiService.request('/payments');
          if (payResp?.success) {
            nextPayments = Array.isArray(payResp.data) ? payResp.data : [];
          }
        }

        if (nextTenants.length || nextPayments.length) {
          setAppData((prev) => ({
            ...prev,
            tenants: nextTenants.length ? nextTenants : prev.tenants || [],
            rentPayments: nextPayments.length ? nextPayments : prev.rentPayments || [],
          }));
        }
      } catch (e) {
        console.warn('Unable to load tenants or rent payments', e?.message || e);
      }
    };

    loadTenantsAndPayments();
  }, [appData.tenants, appData.rentPayments, setAppData]);

  useEffect(() => {
    const loadRents = async () => {
      try {
        const resp = await apiService.request('/rents/all');
        if (resp?.success) {
          const nextRecords = Array.isArray(resp.data) ? resp.data.map(normalizeRentRecord) : [];
          setAppData((prev) => ({ ...prev, rentRecords: nextRecords }));
        }
      } catch (e) {
        console.warn('Unable to load rent records', e?.message || e);
      }
    };
    loadRents();
  }, [setAppData]);

  function runReminderSweep() {
    const reminders = appData.rentReminders || [];
    const records = rentRecords || [];
    const daysBeforeList = (appData.rentSettings && appData.rentSettings.reminderDays) || defaultSettings.reminderDays;
    const nextReminders = [];

    records.forEach((r) => {
      if (!r.dueDate) return;
      const due = new Date(r.dueDate);
      daysBeforeList.forEach((daysBefore) => {
        const when = new Date(due);
        when.setDate(when.getDate() - Number(daysBefore));
        const key = `${r.id}::reminder::${daysBefore}`;
        const exists = reminders.find((rm) => rm.key === key);
        if (when <= new Date() && !exists) {
          const remId = generateReminderId(new Date().toISOString(), reminders.concat(nextReminders));
          nextReminders.push({ id: remId, key, rentId: r.id, tenantId: r.tenantId, tenantName: r.tenantName, type: 'Upcoming', message: `Rent due in ${daysBefore} days for ${r.tenantName}`, date: when.toISOString(), sent: true });
        }
      });

      // overdue reminder and late fee
      const today = new Date();
      if (new Date(r.dueDate) < today && (!r.paidAmount || Number(r.paidAmount) === 0)) {
        const key = `${r.id}::overdue`;
        const exists = reminders.find((rm) => rm.key === key);
        if (!exists) {
          const remId = generateReminderId(new Date().toISOString(), reminders.concat(nextReminders));
          nextReminders.push({ id: remId, key, rentId: r.id, tenantId: r.tenantId, tenantName: r.tenantName, type: 'Overdue', message: `${r.tenantName}'s rent is overdue.`, date: new Date().toISOString(), sent: true });
        }

        // apply late fee if configured and not already applied
        const lateFixed = (appData.rentSettings && Number(appData.rentSettings.lateFeeFixed)) || 0;
        const latePercent = (appData.rentSettings && Number(appData.rentSettings.lateFeePercent)) || 0;
        if ((!r.lateFee || Number(r.lateFee) === 0) && (lateFixed > 0 || latePercent > 0)) {
          const amount = Number(r.amount || 0);
          const fee = lateFixed + Math.round((latePercent / 100) * amount);
          r.lateFee = fee;
          r.remainingAmount = Number(r.remainingAmount || amount) + fee;
        }
      }
    });

    if (nextReminders.length) {
      setAppData((prev) => ({ ...prev, rentReminders: [...nextReminders, ...(prev.rentReminders || [])], rentRecords: (prev.rentRecords || []).map((rec) => { const found = records.find((r) => r.id === rec.id); return found ? { ...rec, lateFee: found.lateFee, remainingAmount: found.remainingAmount } : rec; }), notifications: [...nextReminders.map((n) => ({ id: `notif-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, title: n.type === 'Overdue' ? 'Rent Overdue' : 'Rent Reminder', message: n.message, date: n.date, read: false, type: 'Rent' })), ...(prev.notifications || [])] }));
      notify({ message: `${nextReminders.length} reminders generated`, variant: 'info' });
    }
  }

  const stats = useMemo(() => {
    const totalTenants = tenants.length;
    const activeTenants = tenants.filter((t) => t.status === 'Active').length;
    const totalMonthly = tenants.reduce((s, t) => s + Number(t.monthlyRent || 0), 0);
    const collectedThisMonth = rentPayments
      .filter((p) => p.date && new Date(p.date).getMonth() === new Date().getMonth())
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const pending = rentRecords.filter((r) => calculateRentStatus(r, settings) === 'Due' || calculateRentStatus(r, settings) === 'Upcoming').reduce((s, r) => s + Number(r.remainingAmount || r.amount || 0), 0);
    const overdue = rentRecords.filter((r) => calculateRentStatus(r, settings) === 'Overdue').reduce((s, r) => s + Number(r.remainingAmount || r.amount || 0), 0);
    const partial = rentRecords.filter((r) => calculateRentStatus(r, settings) === 'Partial').length;
    const totalDueThisMonth = rentRecords.filter((r) => r.month === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`).reduce((s, r) => s + Number(r.amount || 0), 0);
    const collectionRate = totalDueThisMonth ? Math.round((collectedThisMonth / totalDueThisMonth) * 100) : 0;

    return {
      totalTenants,
      activeTenants,
      totalMonthly,
      collectedThisMonth,
      pending,
      overdue,
      partial,
      collectionRate,
    };
  }, [tenants, rentRecords, rentPayments, settings]);

  const openAddTenant = () => {
    setEditTenant(null);
    setTenantForm({ ...tenantForm, fullName: '', email: '', phone: '', cnic: '', propertyId: '', propertyName: '', unit: '', monthlyRent: '', securityDeposit: '', leaseStart: '', leaseEnd: '', dueDay: settings.defaultDueDay || 10, status: 'Active' });
    setTenantModalOpen(true);
  };

  const saveTenant = async (e) => {
    e.preventDefault();
    const payload = {
      ...tenantForm,
      fullName: tenantForm.fullName.trim(),
      email: tenantForm.email.trim(),
      phone: tenantForm.phone.trim(),
    };
    if (!payload.fullName || !payload.email) {
      notify({ message: 'Tenant name and email are required.', variant: 'error' });
      return;
    }

    setSavingTenant(true);
    try {
      if (editTenant) {
        const userId = editTenant._id || editTenant.id;
        if (!userId || String(userId).startsWith('tenant-')) {
          throw new Error('This tenant has no backend user record to update.');
        }
        const resp = await apiService.request(`/admin/users/${userId}`, {
          method: 'PUT',
          body: { name: payload.fullName, email: payload.email, phone: payload.phone, role: 'tenant', profile: { ...payload } },
        });
        if (!resp?.success || !resp.data) throw new Error(resp?.message || 'Tenant update failed.');
        const updatedTenant = {
          ...payload,
          ...resp.data,
          id: resp.data._id || resp.data.id || userId,
          _id: resp.data._id || resp.data.id || userId,
          fullName: resp.data.fullName || resp.data.name || payload.fullName,
        };
        setAppData((prev) => ({
          ...prev,
          users: (prev.users || []).map((user) => String(user._id || user.id) === String(userId) ? resp.data : user),
          tenants: (prev.tenants || []).map((tenant) => String(tenant._id || tenant.id) === String(userId) ? updatedTenant : tenant),
        }));
        notify({ message: 'Tenant updated.', variant: 'success' });
      } else {
        const userPayload = {
          name: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          password: payload.password || Math.random().toString(36).slice(2, 8),
          role: 'tenant',
          profile: { ...payload },
        };
        const resp = await apiService.request('/admin/users', { method: 'POST', body: userPayload });
        if (!resp?.success || !resp.data) throw new Error(resp?.message || 'Tenant creation failed.');
        const created = resp.data;
        const tenant = {
          id: created._id || created.id,
          _id: created._id || created.id,
          fullName: created.name || created.fullName || payload.fullName,
          email: created.email || payload.email,
          phone: created.phone || payload.phone,
          ...payload,
        };
        setAppData((prev) => ({
          ...prev,
          users: [created, ...(prev.users || [])],
          tenants: [tenant, ...(prev.tenants || [])],
        }));
        notify({ message: 'Tenant added.', variant: 'success' });
      }
      setTenantModalOpen(false);
    } catch (err) {
      console.error('Save tenant failed', err);
      notify({ message: err?.message || 'Unable to save tenant.', variant: 'error' });
    } finally {
      setSavingTenant(false);
    }
  };

  async function generateMonthlyRent(forDate = new Date()) {
    const month = `${forDate.getFullYear()}-${String(forDate.getMonth() + 1).padStart(2, '0')}`;
    const existing = rentRecords.filter((r) => r.month === month);
    const newRecords = [];
    (tenants || []).forEach((t) => {
      if (t.status !== 'Active') return;
      const exists = existing.find((r) => r.tenantId === t.id && r.month === month);
      if (exists) return;
      const dueDate = new Date(forDate.getFullYear(), forDate.getMonth(), Number(t.dueDay || settings.defaultDueDay || 10)).toISOString();
      const amount = Number(t.monthlyRent || 0);
      const id = generateRentRecordId(dueDate, rentRecords.concat(newRecords));
      const record = {
        id,
        tenantId: t.id,
        tenantName: t.fullName,
        propertyId: t.propertyId || '',
        propertyName: t.propertyName || '',
        month,
        amount,
        paidAmount: 0,
        remainingAmount: amount,
        dueDate,
        lateFee: 0,
        notes: '',
        createdAt: new Date().toISOString(),
      }
      record.status = calculateRentStatus(record, settings);
      newRecords.push(record);
    });

    if (newRecords.length) {
      const createdRecords = [];
      let failedCount = 0;
      for (const nr of newRecords) {
        try {
          const resp = await apiService.request('/rents', {
            method: 'POST',
            body: {
              userId: nr.tenantId,
              userName: nr.tenantName,
              propertyId: nr.propertyId,
              propertyName: nr.propertyName,
              monthlyRent: nr.amount,
              paid: 0,
              dueDate: nr.dueDate,
              month: nr.month,
              status: nr.status,
            },
          });
          if (!resp?.success || !resp.data) throw new Error(resp?.message || 'Rent record was not saved.');
          createdRecords.push(normalizeRentRecord(resp.data, createdRecords.length));
        } catch (err) {
          console.error('Create rent record failed', nr.tenantId, err);
          failedCount += 1;
        }
      }

      if (createdRecords.length) {
        setAppData((prev) => ({ ...prev, rentRecords: [...createdRecords, ...(prev.rentRecords || [])] }));
      }
      if (failedCount && createdRecords.length) {
        notify({ message: `${createdRecords.length} rent records saved; ${failedCount} failed.`, variant: 'warning' });
      } else if (failedCount) {
        notify({ message: 'Rent records could not be saved. Check the backend connection and try again.', variant: 'error' });
      } else {
        notify({ message: `${createdRecords.length} rent records generated for ${month}`, variant: 'success' });
      }
    } else {
      notify({ message: 'No new rent records to generate', variant: 'info' });
    }
  };

  const openPaymentModalFor = (rentRecord) => {
    setPaymentForm({ rentId: rentRecord.id, amount: '', method: 'Cash', transactionId: '', date: new Date().toISOString(), notes: '' });
    setPaymentModalOpen(true);
  };

  const savePayment = async (e) => {
    e.preventDefault();
    const rentId = paymentForm.rentId;
    const record = (rentRecords || []).find((r) => r.id === rentId || String(r._id || r.id) === String(rentId));
    if (!record) {
      notify({ message: 'Rent record not found', variant: 'danger' });
      return;
    }
    const amount = Number(paymentForm.amount || 0);
    if (!amount || amount <= 0) {
      notify({ message: 'Enter valid amount', variant: 'danger' });
      return;
    }

    const payload = {
      rentId: record._id || record.id,
      tenantId: record.tenantId,
      tenantName: record.tenantName,
      propertyId: record.propertyId,
      propertyName: record.propertyName,
      amount,
      method: paymentForm.method,
      transactionId: paymentForm.transactionId,
      date: paymentForm.date || new Date().toISOString(),
      notes: paymentForm.notes || '',
    };

    try {
      const paymentResponse = await apiService.request('/payments', { method: 'POST', body: payload });
      if (!paymentResponse?.success || !paymentResponse.data) {
        throw new Error(paymentResponse?.message || 'Payment was not saved.');
      }
      const savedPayment = paymentResponse.data;

      const targetId = record._id || record.id;
      let updatedRent = null;
      let rentUpdateError = null;
      if (targetId) {
        const paid = Number(record?.paidAmount || record?.paid || 0) + amount;
        const amountTotal = Number(record?.amount || record?.monthlyRent || 0);
        const remaining = Math.max(amountTotal - paid, 0);
        const status = paid >= amountTotal ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';

        try {
          const rentResponse = await apiService.request(`/rents/${targetId}`, { method: 'PATCH', body: { paid, remaining, status } });
          if (!rentResponse?.success || !rentResponse.data) {
            throw new Error(rentResponse?.message || 'Rent balance was not updated.');
          }
          updatedRent = rentResponse.data;
        } catch (err) {
          rentUpdateError = err;
          console.error('Failed to persist rent update after payment was recorded', err);
        }
      } else {
        rentUpdateError = new Error('The rent record has no backend identifier.');
      }

      setAppData((prev) => {
        const nextPayments = [savedPayment, ...(prev.rentPayments || [])];

        const nextRecords = (prev.rentRecords || []).map((r) => {
          const match = String(r._id || r.id) === String(targetId) || String(r.id) === String(rentId);
          if (!match) return r;
          if (!updatedRent) return r;
          return { ...r, ...normalizeRentRecord(updatedRent, 0) };
        });

        const notif = {
          id: `notif-${Date.now()}`,
          title: 'Rent Payment Recorded',
          message: `${payload.tenantName} paid ${formatCurrency(payload.amount, prev.rentSettings?.currency || 'PKR')}`,
          detail: `Payment ${savedPayment._id || savedPayment.id} recorded for ${payload.tenantName}`,
          type: 'Rent',
          recipient: 'Admin',
          date: new Date().toISOString(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false,
          priority: 'Normal',
        };

        return { ...prev, rentPayments: nextPayments, rentRecords: nextRecords, notifications: [notif, ...(prev.notifications || [])] };
      });

      if (rentUpdateError) {
        notify({ message: 'Payment was recorded, but the rent balance could not be updated. Do not submit this payment again.', variant: 'warning' });
      } else {
        notify({ message: 'Payment saved', variant: 'success' });
      }
      setPaymentModalOpen(false);
    } catch (err) {
      console.error('Save payment failed', err);
      notify({ message: 'Failed to save payment', variant: 'danger' });
    }
  };

  const sendReminder = async (record, type = 'Due') => {
    const remId = generateReminderId(new Date().toISOString(), appData.rentReminders || []);
    const reminder = {
      id: remId,
      rentId: record.id,
      tenantId: record.tenantId,
      tenantName: record.tenantName,
      propertyId: record.propertyId,
      propertyName: record.propertyName,
      type,
      message: type === 'Overdue' ? `${record.tenantName}'s rent is overdue.` : `Rent reminder for ${record.tenantName}`,
      date: new Date().toISOString(),
      sent: true,
    };

    try {
      const response = await apiService.request('/notifications/create', {
        method: 'POST',
        body: {
          userId: record.tenantId,
          userName: record.tenantName,
          entityType: 'RENT',
          entityId: record._id || record.id,
          title: type === 'Overdue' ? 'Rent overdue' : 'Rent reminder',
          message: reminder.message,
          detail: `Rent reminder for ${record.tenantName} for ${record.propertyName || 'their property'}.`,
          actorType: 'admin',
          actorName: 'Admin',
          actionType: 'REMINDER',
          status: 'Notice',
          date: reminder.date,
        },
      });
      if (!response?.success || !response.data) {
        throw new Error(response?.message || 'Reminder was not saved.');
      }
      setAppData((prev) => ({
        ...prev,
        rentReminders: [reminder, ...(prev.rentReminders || [])],
        notifications: [response.data, ...(prev.notifications || [])],
      }));
      notify({ message: 'Reminder sent', variant: 'success' });
    } catch (error) {
      console.error('Send rent reminder failed', error);
      notify({ message: error?.message || 'Unable to send rent reminder.', variant: 'error' });
    }
  };

  const tenantRows = (tenants || []).map((t) => (
    <tr key={t.id}>
      <td>{t.id}</td>
      <td>{t.fullName}</td>
      <td>{t.email}</td>
      <td>{t.phone}</td>
      <td>{t.propertyName || ''}</td>
      <td>{formatCurrency(t.monthlyRent || 0, settings.currency)}</td>
      <td>{t.dueDay || settings.defaultDueDay}</td>
      <td>
        <div className="table-actions">
          <button type="button" className="table-button light" onClick={() => navigate(`/admin/tenant-profile/${encodeURIComponent(t.id || t.fullName)}`)}>Profile</button>
          <button type="button" className="table-button light" onClick={() => { setEditTenant(t); setTenantForm(t); setTenantModalOpen(true); }}>Edit</button>
        </div>
      </td>
    </tr>
  ));

  const rentRows = (rentRecords || []).map((r) => (
    <tr key={r.id}>
      <td>{r.id}</td>
      <td>{r.tenantName}</td>
      <td>{r.propertyName}</td>
      <td>{r.month}</td>
      <td>{formatCurrency(r.amount || 0, settings.currency)}</td>
      <td>{formatCurrency(r.paidAmount || 0, settings.currency)}</td>
      <td>{formatCurrency(r.remainingAmount || 0, settings.currency)}</td>
      <td>{formatDate(r.dueDate)}</td>
      <td>{formatCurrency(r.lateFee || 0, settings.currency)}</td>
      <td><span className={`status-badge ${String(r.status || '').toLowerCase()}`}>{r.status}</span></td>
      <td>
        <button type="button" className="table-button" onClick={() => openPaymentModalFor(r)}>Record Payment</button>
        <button type="button" className="table-button light" onClick={() => sendReminder(r, r.status)}>Send Reminder</button>
      </td>
    </tr>
  ));

  const summaryItems = [
    { label: 'Total Tenants', value: stats.totalTenants, tone: 'primary' },
    { label: 'Collection Rate', value: `${stats.collectionRate}%`, tone: 'success' },
    { label: 'Collected This Month', value: formatCurrency(stats.collectedThisMonth, settings.currency), tone: 'success' },
    { label: 'Outstanding', value: formatCurrency(stats.pending + stats.overdue, settings.currency), tone: 'danger' },
  ];

  return (
    <div className="page-section rent-page">
      <div className="panel-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Rent operations</p>
            <h3>Rent Management</h3>
          </div>
          <div className="rent-actions">
            <div className="tab-switcher" aria-label="Rent tabs">
              <button type="button" className={`tab-button ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>Dashboard</button>
              <button type="button" className={`tab-button ${tab === 'tenants' ? 'active' : ''}`} onClick={() => setTab('tenants')}>Tenants</button>
              <button type="button" className={`tab-button ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>Rent Records</button>
              <button type="button" className={`tab-button ${tab === 'payments' ? 'active' : ''}`} onClick={() => setTab('payments')}>Payments</button>
            </div>
            <button type="button" className="primary-button" onClick={() => generateMonthlyRent(new Date())}>Generate Monthly Rent</button>
            <button type="button" className="mini-button" onClick={() => setSettingsOpen(true)}>Settings</button>
          </div>
        </div>

        <div className="rent-summary-grid">
          {summaryItems.map((item) => (
            <div key={item.label} className={`summary-metric tone-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        {tab === 'dashboard' && (
          <div>
            <div className="stats-grid three-column">
              <div className="stat-card primary">
                <p>Total Tenants</p>
                <h3>{stats.totalTenants}</h3>
              </div>
              <div className="stat-card success">
                <p>Active Tenants</p>
                <h3>{stats.activeTenants}</h3>
              </div>
              <div className="stat-card warning">
                <p>Total Monthly Rent</p>
                <h3>{formatCurrency(stats.totalMonthly, settings.currency)}</h3>
              </div>
              <div className="stat-card primary">
                <p>Collected This Month</p>
                <h3>{formatCurrency(stats.collectedThisMonth, settings.currency)}</h3>
              </div>
              <div className="stat-card danger">
                <p>Pending Rent</p>
                <h3>{formatCurrency(stats.pending, settings.currency)}</h3>
              </div>
              <div className="stat-card danger">
                <p>Overdue Rent</p>
                <h3>{formatCurrency(stats.overdue, settings.currency)}</h3>
              </div>
              <div className="stat-card info">
                <p>Partial Payments</p>
                <h3>{stats.partial}</h3>
              </div>
              <div className="stat-card success">
                <p>Collection Rate</p>
                <h3>{stats.collectionRate}%</h3>
              </div>
            </div>
          </div>
        )}

        {tab === 'tenants' && (
          <div>
            <div className="toolbar-row">
              <div />
              <div className="toolbar-group">
                <button type="button" className="primary-button" onClick={openAddTenant}>Add Tenant</button>
              </div>
            </div>

              <Modal open={settingsOpen} title="Rent Settings" onClose={() => setSettingsOpen(false)} footer={<><button type="button" className="outline-button" onClick={() => setSettingsOpen(false)}>Close</button><button type="button" className="primary-button" onClick={() => setAppData((prev) => ({ ...prev }))}>Save</button></>}>
                <div className="form-grid two-col">
                  <label>
                    Default Due Day
                    <input type="number" defaultValue={settings.defaultDueDay} onBlur={(e) => setAppData((prev) => ({ ...prev, rentSettings: { ...prev.rentSettings, defaultDueDay: Number(e.target.value) } }))} />
                  </label>
                  <label>
                    Grace Period (days)
                    <input type="number" defaultValue={settings.gracePeriod} onBlur={(e) => setAppData((prev) => ({ ...prev, rentSettings: { ...prev.rentSettings, gracePeriod: Number(e.target.value) } }))} />
                  </label>
                  <label>
                    Late Fee Fixed
                    <input type="number" defaultValue={settings.lateFeeFixed} onBlur={(e) => setAppData((prev) => ({ ...prev, rentSettings: { ...prev.rentSettings, lateFeeFixed: Number(e.target.value) } }))} />
                  </label>
                  <label>
                    Late Fee %
                    <input type="number" defaultValue={settings.lateFeePercent} onBlur={(e) => setAppData((prev) => ({ ...prev, rentSettings: { ...prev.rentSettings, lateFeePercent: Number(e.target.value) } }))} />
                  </label>
                  <label>
                    Reminder Days (comma separated)
                    <input defaultValue={(settings.reminderDays || []).join(',')} onBlur={(e) => setAppData((prev) => ({ ...prev, rentSettings: { ...prev.rentSettings, reminderDays: String(e.target.value).split(',').map((v) => Number(v.trim())).filter(Boolean) } }))} />
                  </label>
                  <label>
                    Auto-generate monthly rent
                    <select defaultValue={settings.autoGenerate ? 'true' : 'false'} onBlur={(e) => setAppData((prev) => ({ ...prev, rentSettings: { ...prev.rentSettings, autoGenerate: e.target.value === 'true' } }))}>
                      <option value="false">Disabled</option>
                      <option value="true">Enabled</option>
                    </select>
                  </label>
                </div>
              </Modal>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Property</th>
                    <th>Monthly Rent</th>
                    <th>Due Day</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>{tenantRows}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'records' && (
          <div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rent ID</th>
                    <th>Tenant</th>
                    <th>Property</th>
                    <th>Month</th>
                    <th>Rent</th>
                    <th>Paid</th>
                    <th>Remaining</th>
                    <th>Due Date</th>
                    <th>Late Fee</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>{rentRows}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Tenant</th>
                    <th>Property</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Date</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(rentPayments || []).map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.tenantName}</td>
                      <td>{p.propertyName}</td>
                      <td>{formatCurrency(p.amount, settings.currency)}</td>
                      <td>{p.method}</td>
                      <td>{formatDateTime(p.date)}</td>
                      <td>{p.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={tenantModalOpen} title={editTenant ? 'Edit Tenant' : 'Add Tenant'} onClose={() => !savingTenant && setTenantModalOpen(false)} footer={<><button type="button" className="outline-button" onClick={() => setTenantModalOpen(false)} disabled={savingTenant}>Cancel</button><button type="submit" form="tenant-form" className="primary-button" disabled={savingTenant}>{savingTenant ? 'Saving…' : 'Save'}</button></>}>
        <form id="tenant-form" className="property-form" onSubmit={saveTenant}>
          <div className="form-grid two-col">
            <label>
              Full Name
              <input value={tenantForm.fullName} onChange={(e) => setTenantForm((prev) => ({ ...prev, fullName: e.target.value }))} />
            </label>
            <label>
              Email
              <input value={tenantForm.email} onChange={(e) => setTenantForm((prev) => ({ ...prev, email: e.target.value }))} />
            </label>
            <label>
              Phone
              <input value={tenantForm.phone} onChange={(e) => setTenantForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label>
              CNIC/ID
              <input value={tenantForm.cnic} onChange={(e) => setTenantForm((prev) => ({ ...prev, cnic: e.target.value }))} />
            </label>
            <label>
              Property ID
              <input value={tenantForm.propertyId} onChange={(e) => setTenantForm((prev) => ({ ...prev, propertyId: e.target.value }))} />
            </label>
            <label>
              Property Name
              <input value={tenantForm.propertyName} onChange={(e) => setTenantForm((prev) => ({ ...prev, propertyName: e.target.value }))} />
            </label>
            <label>
              Monthly Rent
              <input type="number" value={tenantForm.monthlyRent} onChange={(e) => setTenantForm((prev) => ({ ...prev, monthlyRent: e.target.value }))} />
            </label>
            <label>
              Security Deposit
              <input type="number" value={tenantForm.securityDeposit} onChange={(e) => setTenantForm((prev) => ({ ...prev, securityDeposit: e.target.value }))} />
            </label>
            <label>
              Lease Start
              <input type="date" value={tenantForm.leaseStart} onChange={(e) => setTenantForm((prev) => ({ ...prev, leaseStart: e.target.value }))} />
            </label>
            <label>
              Lease End
              <input type="date" value={tenantForm.leaseEnd} onChange={(e) => setTenantForm((prev) => ({ ...prev, leaseEnd: e.target.value }))} />
            </label>
            <label>
              Rent Due Day
              <input type="number" value={tenantForm.dueDay} onChange={(e) => setTenantForm((prev) => ({ ...prev, dueDay: e.target.value }))} />
            </label>
            <label>
              Status
              <select value={tenantForm.status} onChange={(e) => setTenantForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option>Active</option>
                <option>Pending</option>
                <option>Expired</option>
                <option>Terminated</option>
              </select>
            </label>
          </div>
        </form>
      </Modal>

      <Modal open={paymentModalOpen} title="Record Rent Payment" onClose={() => setPaymentModalOpen(false)} footer={<><button type="button" className="outline-button" onClick={() => setPaymentModalOpen(false)}>Cancel</button><button type="submit" form="payment-form" className="primary-button">Save</button></>}>
        <form id="payment-form" className="property-form" onSubmit={savePayment}>
          <div className="form-grid two-col">
            <label>
              Rent Record
              <input value={paymentForm.rentId} readOnly />
            </label>
            <label>
              Amount
              <input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </label>
            <label>
              Method
              <select value={paymentForm.method} onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}>
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Transaction ID
              <input value={paymentForm.transactionId} onChange={(e) => setPaymentForm((prev) => ({ ...prev, transactionId: e.target.value }))} />
            </label>
            <label>
              Date
              <input type="datetime-local" value={paymentForm.date ? paymentForm.date.slice(0, 16) : ''} onChange={(e) => setPaymentForm((prev) => ({ ...prev, date: new Date(e.target.value).toISOString() }))} />
            </label>
            <label>
              Notes
              <input value={paymentForm.notes} onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default RentManagementPage;
