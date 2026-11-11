import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PaymentsPage.css";
import Modal from "../components/Modal";
import { formatCurrency, formatDate } from "../utils/formatters";
import { apiService } from "../services/api";

const emptyForm = {
  user: "",
  property: "",
  amount: "",
  status: "Paid",
  method: "Bank Transfer",
  note: "",
};

function PaymentsPage({ appData, setAppData, notify }) {
  const payments = appData.payments || [];
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const normalizePayment = (payment, index) => ({
    ...payment,
    _id: payment._id || payment.id || payment.paymentId || payment.transactionId || `payment-${index + 1}`,
    id: payment.id || payment._id || payment.paymentId || payment.transactionId || `payment-${index + 1}`,
    userName: payment.userName || payment.user || payment.customerName || payment.name || 'Unknown User',
    propertyName: payment.propertyName || payment.property || payment.propertyTitle || 'Unknown Property',
    status: payment.status || 'Pending',
    paymentDate: payment.paymentDate || payment.date || payment.createdAt || new Date().toISOString(),
  });

  useEffect(() => {
    const loadPayments = async () => {
      setLoadingPayments(true);
      try {
        const response = await apiService.request('/payments');
        if (response?.success) {
          const nextPayments = Array.isArray(response.data) ? response.data.map(normalizePayment) : [];
          setAppData((prev) => ({ ...prev, payments: nextPayments }));
        }
      } catch (error) {
        console.warn('Unable to load payments from backend:', error?.message || error);
      } finally {
        setLoadingPayments(false);
      }
    };

    loadPayments();
  }, [setAppData]);

  const getPaymentId = (payment) => payment?._id || payment?.id || payment?.paymentId || payment?.transactionId || 'N/A';

  const filteredPayments = useMemo(() => {
    const next = [...payments].filter((payment) => {
      const userName = payment.userName || payment.user || payment.customerName || payment.userId || '';
      const propertyName = payment.propertyName || payment.property || payment.propertyTitle || '';
      const matchesSearch =
        !search ||
        [userName, propertyName, getPaymentId(payment)]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "All" || String(payment.status || '').toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
    return next.sort((a, b) => new Date(b.paymentDate || b.date || 0) - new Date(a.paymentDate || a.date || 0));
  }, [payments, search, statusFilter]);

  const paymentStats = useMemo(() => {
    const totalPaid = payments.filter((item) => ['paid', 'approved', 'completed', 'success', 'settled'].includes(String(item.status || '').toLowerCase())).length;
    const totalPending = payments.filter((item) => !['paid', 'approved', 'completed', 'success', 'settled'].includes(String(item.status || '').toLowerCase())).length;
    const collected = payments
      .filter((item) => ['paid', 'approved', 'completed', 'success', 'settled'].includes(String(item.status || '').toLowerCase()))
      .reduce((sum, item) => sum + Number(item.amount || item.totalAmount || 0), 0);

    return { totalPaid, totalPending, collected };
  }, [payments]);

  const totalCollected = payments
    .filter((payment) => ['paid', 'approved', 'completed', 'success', 'settled'].includes(String(payment.status || '').toLowerCase()))
    .reduce((sum, payment) => sum + Number(payment.amount || payment.totalAmount || 0), 0);

  const validate = () => {
    const nextErrors = {};
    if (!formData.user.trim()) nextErrors.user = "Payer is required";
    if (!formData.property.trim()) nextErrors.property = "Property is required";
    if (!formData.amount || Number(formData.amount) <= 0)
      nextErrors.amount = "Valid amount is required";
    return nextErrors;
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        userId: formData.user.trim(),
        userName: formData.user.trim(),
        userEmail: '',
        propertyId: '',
        propertyName: formData.property.trim(),
        propertyType: 'Property',
        amount: Number(formData.amount),
        totalAmount: Number(formData.amount),
        amountPaid: Number(formData.amount),
        advanceAmount: 0,
        paymentType: formData.method,
        method: formData.method,
        status: formData.status,
        reason: formData.note.trim(),
        notes: formData.note.trim(),
        paymentDate: new Date().toISOString(),
      };

      const response = await apiService.request('/payments', {
        method: 'POST',
        body: payload,
      });

      if (!response?.success || !response.data) {
        throw new Error(response?.message || 'Payment was not saved.');
      }
      const createdPayment = response.data;
      setAppData((prev) => ({
        ...prev,
        payments: [createdPayment, ...(prev.payments || [])],
        dues: (prev.dues || []).map((due) =>
          due.user === formData.user.trim() && due.property === formData.property.trim() && formData.status === 'Paid'
            ? {
                ...due,
                status: 'Paid',
                paymentStatus: 'Paid',
                updatedAt: new Date().toISOString(),
              }
            : due,
        ),
      }));

      notify({ message: "Payment recorded successfully.", variant: "success" });
      setModalOpen(false);
      setFormData(emptyForm);
      setErrors({});
    } catch (error) {
      console.error('Payment save failed:', error);
      notify({ message: error.message || 'Unable to record payment.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-section payments-page">
      <div className="summary-strip payment-strip">
        <div className="summary-item primary">
          <span>Collected</span>
          <strong>{formatCurrency(paymentStats.collected)}</strong>
        </div>
        <div className="summary-item success">
          <span>Paid</span>
          <strong>{paymentStats.totalPaid}</strong>
        </div>
        <div className="summary-item danger">
          <span>Pending</span>
          <strong>{paymentStats.totalPending}</strong>
        </div>
        <div className="summary-item info">
          <span>Ledger total</span>
          <strong>{formatCurrency(payments.reduce((sum, item) => sum + Number(item.amount || item.totalAmount || 0), 0))}</strong>
        </div>
      </div>

      <section className="panel-card toolbar-card">
        <div className="toolbar-row">
          <div className="toolbar-search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by user or property"
            />
          </div>
          <div className="toolbar-group">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
            </select>
            <button
              type="button"
              className="primary-button"
              onClick={() => setModalOpen(true)}
              disabled={loadingPayments || saving}
            >
              Record Payment
            </button>
          </div>
        </div>
      </section>

      <div className="stats-grid three-column">
        <div className="stat-card primary">
          <p>Collected</p>
          <h3>{formatCurrency(totalCollected)}</h3>
        </div>
        <div className="stat-card success">
          <p>Paid</p>
          <h3>{paymentStats.totalPaid}</h3>
        </div>
        <div className="stat-card warning">
          <p>Pending</p>
          <h3>{paymentStats.totalPending}</h3>
        </div>
      </div>

      <section className="panel-card">
        <div className="card-header">
          <h3>Payment Ledger</h3>
          <span className="mini-badge">{filteredPayments.length} records</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>User</th>
                <th>Property</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => {
                const paymentId = getPaymentId(payment);
                const userName = payment.userName || payment.user || payment.customerName || payment.userId || 'Unknown';
                const propertyName = payment.propertyName || payment.property || payment.propertyTitle || 'Unknown';

                return (
                  <tr key={paymentId}>
                    <td>{paymentId}</td>
                    <td>{userName}</td>
                    <td>{propertyName}</td>
                    <td>{formatCurrency(payment.amount || payment.totalAmount || 0)}</td>
                    <td>{payment.paymentMethod || payment.method || "Bank Transfer"}</td>
                    <td>{formatDate(payment.paymentDate || payment.date)}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="table-button light" onClick={() => navigate(`/admin/tenant-profile/${encodeURIComponent(userName || paymentId)}`)}>Profile</button>
                        <span className={`status-badge ${String(payment.status || 'Pending').toLowerCase()}`}>{payment.status || 'Pending'}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title="Record Payment"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="outline-button"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
              form="payment-form"
            >
              Save
            </button>
          </>
        }
      >
        <form id="payment-form" className="property-form" onSubmit={handleSave}>
          <div className="form-grid two-col">
            <label>
              User
              <input
                value={formData.user}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, user: event.target.value }))
                }
              />
              {errors.user && (
                <span className="field-error">{errors.user}</span>
              )}
            </label>
            <label>
              Property
              <input
                value={formData.property}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    property: event.target.value,
                  }))
                }
              />
              {errors.property && (
                <span className="field-error">{errors.property}</span>
              )}
            </label>
          </div>
          <div className="form-grid two-col">
            <label>
              Amount
              <input
                type="number"
                value={formData.amount}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
              />
              {errors.amount && (
                <span className="field-error">{errors.amount}</span>
              )}
            </label>
            <label>
              Method
              <select
                value={formData.method}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    method: event.target.value,
                  }))
                }
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Wallet">Wallet</option>
              </select>
            </label>
          </div>
          <div className="form-grid two-col">
            <label>
              Status
              <select
                value={formData.status}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }))
                }
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
              </select>
            </label>
          </div>
          <label>
            Note
            <textarea
              rows="3"
              value={formData.note}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, note: event.target.value }))
              }
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}

export default PaymentsPage;
