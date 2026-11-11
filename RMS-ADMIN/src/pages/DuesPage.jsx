import { useMemo, useState, useEffect } from 'react';
import { createAdminPayment } from '../services/adminPaymentService';
import { apiService } from '../services/api';
import './DuesPage.css';
import { formatCurrency, formatDate } from '../utils/formatters';

function DuesPage({ appData, setAppData, notify }) {
  const dues = appData.dues || [];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const normalizeDueStatus = (due) => {
    const raw = String(due?.status || due?.paymentStatus || due?.state || 'Due');
    const value = raw.trim().toLowerCase();

    if (['paid', 'completed', 'settled', 'success'].includes(value)) return 'Paid';
    if (['overdue', 'late', 'delinquent'].includes(value)) return 'Overdue';
    if (['pending', 'in review', 'review', 'waiting'].includes(value)) return 'Pending';
    if (['due', 'open', 'outstanding'].includes(value)) return 'Due';

    return raw || 'Due';
  };

  const getDueAmount = (due) => Number(due?.remainingAmount ?? due?.amount ?? due?.totalAmount ?? 0);
  const getDueUser = (due) => due?.user || due?.residentName || due?.tenantName || 'N/A';
  const getDueProperty = (due) => due?.property || due?.propertyName || due?.unit || 'N/A';
  const getDueId = (due) => due?.id || due?._id || due?.dueId || due?.reference || 'N/A';

  const summary = useMemo(() => {
    const outstanding = dues.filter((item) => ['Due', 'Pending', 'Overdue'].includes(normalizeDueStatus(item))).reduce((sum, item) => sum + getDueAmount(item), 0);
    const paid = dues.filter((item) => normalizeDueStatus(item) === 'Paid').reduce((sum, item) => sum + getDueAmount(item), 0);
    const overdue = dues.filter((item) => normalizeDueStatus(item) === 'Overdue').length;
    const pending = dues.filter((item) => normalizeDueStatus(item) === 'Pending').length;

    return { outstanding, paid, overdue, pending };
  }, [dues]);

  const filteredDues = useMemo(() => {
    const next = [...dues].filter((due) => {
      const normalizedStatus = normalizeDueStatus(due);
      const matchesSearch =
        !search ||
        [getDueUser(due), getDueProperty(due), getDueId(due)]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || normalizedStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
    return next.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
  }, [dues, search, statusFilter]);

  const markPaid = (dueId) => {
    (async () => {
      try {
        notify && notify({ message: 'Recording payment...', variant: 'info' });
        const due = (appData.dues || []).find((d) => String(getDueId(d)) === String(dueId));
        const payload = {
          user: due?.user || '',
          userName: due?.residentName || due?.user || '',
          property: getDueProperty(due),
          propertyName: getDueProperty(due),
          amount: getDueAmount(due),
          totalAmount: Number(due?.amount || 0),
          amountPaid: getDueAmount(due),
          paymentDate: new Date().toISOString(),
          status: 'Paid',
          method: 'Admin Adjustment',
          notes: 'Marked paid by admin from dues panel',
        };

        const created = await createAdminPayment(payload);
        if (created) {
          setAppData((prev) => ({
            ...prev,
            dues: (prev.dues || []).map((item) => (String(getDueId(item)) === String(dueId) ? { ...item, status: 'Paid', paymentStatus: 'Paid', updatedAt: new Date().toISOString() } : item)),
            payments: [created, ...(prev.payments || [])],
          }));
          notify && notify({ message: 'Due marked as paid.', variant: 'success' });
        } else {
          notify && notify({ message: 'Payment recorded but no response from server.', variant: 'warning' });
        }
      } catch (e) {
        console.error('Mark paid failed', e);
        notify && notify({ message: e?.message || 'Unable to mark due as paid.', variant: 'error' });
      }
    })();
  };

  const sendReminder = async (due) => {
    try {
      notify && notify({ message: `Sending reminder to ${getDueUser(due)}...`, variant: 'info' });
      const payload = {
        userId: due?.userId || due?.user || '',
        userName: getDueUser(due),
        entityType: 'RENT',
        entityId: getDueId(due),
        title: 'Rent reminder',
        message: `Reminder: rent due for ${getDueProperty(due)}. Please pay ${formatCurrency(getDueAmount(due))}.`,
        detail: `Reminder sent for ${getDueUser(due)} for ${getDueProperty(due)}.`,
        actorType: 'system',
        actorName: 'System',
        actionType: 'REMINDER',
        status: 'Notice',
        date: new Date().toISOString(),
      };
      const resp = await apiService.request('/notifications/create', { method: 'POST', body: payload });
      if (!resp?.success || !resp.data) {
        throw new Error(resp?.message || `Unable to send reminder to ${getDueUser(due)}.`);
      }
      setAppData((prev) => ({ ...prev, notifications: [resp.data, ...(prev.notifications || [])] }));
      notify && notify({ message: `Reminder sent to ${getDueUser(due)}.`, variant: 'info' });
    } catch (e) {
      console.error('Send reminder failed', e);
      notify && notify({ message: e?.message || `Unable to send reminder to ${getDueUser(due)}.`, variant: 'error' });
    }
  };

  const sendOutstandingReminders = async () => {
    const unpaidDues = filteredDues.filter((due) => normalizeDueStatus(due) !== 'Paid');
    if (!unpaidDues.length) {
      notify && notify({ message: 'There are no unpaid dues to remind.', variant: 'info' });
      return;
    }
    await Promise.all(unpaidDues.map(sendReminder));
  };

  useEffect(() => {
    const loadDues = async () => {
      try {
        const res = await apiService.request('/dues');
        if (res?.success) {
          const items = Array.isArray(res.data) ? res.data : [];
          setAppData((prev) => ({ ...prev, dues: items }));
        }
      } catch (err) {
        console.error('Failed to load dues:', err);
        notify && notify({ message: err?.message || 'Unable to load dues.', variant: 'error' });
      }
    };

    loadDues();
  }, [setAppData, notify]);

  return (
    <div className="page-section dues-page">
      <div className="summary-strip dues-strip">
        <div className="summary-item primary">
          <span>Outstanding</span>
          <strong>{formatCurrency(summary.outstanding)}</strong>
        </div>
        <div className="summary-item success">
          <span>Paid</span>
          <strong>{formatCurrency(summary.paid)}</strong>
        </div>
        <div className="summary-item danger">
          <span>Overdue</span>
          <strong>{summary.overdue}</strong>
        </div>
        <div className="summary-item info">
          <span>Pending</span>
          <strong>{summary.pending}</strong>
        </div>
      </div>

      <section className="panel-card toolbar-card">
        <div className="toolbar-row">
          <div className="toolbar-search">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search due by user or property" />
          </div>
          <div className="toolbar-group">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All Status</option>
              <option value="Due">Due</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>
            <button type="button" className="mini-button" onClick={sendOutstandingReminders}>
              Send Reminders
            </button>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="card-header">
          <h3>Rent & Due Management</h3>
          <span className="mini-badge">{filteredDues.length} dues</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Due ID</th>
                <th>User</th>
                <th>Property</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDues.map((due) => {
                const status = normalizeDueStatus(due);
                const rowId = getDueId(due);
                const amount = getDueAmount(due);
                return (
                  <tr key={rowId}>
                    <td>{rowId}</td>
                    <td>{getDueUser(due)}</td>
                    <td>{getDueProperty(due)}</td>
                    <td>{formatCurrency(amount)}</td>
                    <td>{formatDate(due.dueDate)}</td>
                    <td>
                      <span className={`status-badge ${String(status).toLowerCase()}`}>{status}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="table-button light" onClick={() => markPaid(rowId)} disabled={status === 'Paid'}>
                          {status === 'Paid' ? 'Paid' : 'Mark Paid'}
                        </button>
                        <button type="button" className="table-button light" onClick={() => sendReminder(due)}>Remind</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default DuesPage;
