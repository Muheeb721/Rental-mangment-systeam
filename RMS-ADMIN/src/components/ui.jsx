/* eslint-disable react-refresh/only-export-components */
import { Fragment, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Inbox, Loader2, Search, X, XCircle, Star,
} from 'lucide-react';
import { toneFor, initials } from '../lib/format';
import { assetUrl } from '../lib/api';

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);
  const push = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((list) => [...list.slice(-3), { id, type, message }]);
    window.setTimeout(() => remove(id), type === 'error' ? 6000 : 3500);
  }, [remove]);
  const value = useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message),
    warning: (message) => push('warning', message),
  }), [push]);
  const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <div key={toast.id} className={`toast ${toast.type}`}>
              <Icon size={18} className="toast-icon" />
              <div className="toast-msg">{toast.message}</div>
              <button type="button" className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => remove(toast.id)} aria-label="Dismiss"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---------------------------------------------------------------------------
// Modal + confirm dialog
// ---------------------------------------------------------------------------
export function Modal({ open, title, onClose, children, footer, size = '', busy = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose?.(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose, busy]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose?.(); }}>
      <div className={`modal ${size ? `modal-${size}` : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

const ConfirmContext = createContext(null);

/**
 * confirm({ title, message, confirmLabel, tone: 'danger'|'primary', input: { label, placeholder, required } })
 * resolves to false (cancelled), true, or the entered text when `input` is given.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const [text, setText] = useState('');
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setText('');
    setState(options);
  }), []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  const tone = state?.tone || 'danger';
  const inputMissing = state?.input?.required && !text.trim();
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        size="sm"
        title={state?.title || 'Are you sure?'}
        onClose={() => close(false)}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => close(false)}>Cancel</button>
            <button
              type="button"
              className={`btn ${tone === 'danger' ? 'btn-danger' : tone === 'success' ? 'btn-success' : 'btn-primary'}`}
              disabled={inputMissing}
              onClick={() => close(state?.input ? text.trim() : true)}
              autoFocus={!state?.input}
            >
              {state?.confirmLabel || 'Confirm'}
            </button>
          </>
        )}
      >
        <div className={`confirm-icon tone-${tone === 'danger' ? 'red' : tone === 'success' ? 'green' : 'blue'}`}>
          {tone === 'danger' ? <AlertTriangle size={22} /> : <Info size={22} />}
        </div>
        <p style={{ color: 'var(--text-2)' }}>{state?.message}</p>
        {state?.input && (
          <div className="field mt-16">
            <label className="field-label" htmlFor="confirm-input">{state.input.label}{state.input.required && <span className="req">*</span>}</label>
            <textarea id="confirm-input" className="textarea" rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder={state.input.placeholder} autoFocus />
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
export const Spinner = ({ size = 18 }) => <Loader2 size={size} className="spin" />;

export function Button({ variant = 'secondary', size, loading = false, icon: Icon, children, className = '', ...props }) {
  return (
    <button type="button" className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner size={15} /> : Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, danger = false, badge, ...props }) {
  return (
    <button type="button" className={`icon-btn ${danger ? 'danger' : ''}`} title={label} aria-label={label} {...props}>
      <Icon size={16} />
      {badge ? <span className="dot">{badge > 99 ? '99+' : badge}</span> : null}
    </button>
  );
}

export const Badge = ({ children, tone, dot = true }) => (
  <span className={`badge tone-${tone || toneFor(children)} ${dot ? '' : 'no-dot'}`}>{children || '—'}</span>
);

export function Avatar({ name, src, size = '' }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`avatar ${size ? `avatar-${size}` : ''}`}>
      {src && !failed ? <img src={assetUrl(src)} alt="" onError={() => setFailed(true)} /> : initials(name)}
    </span>
  );
}

export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= value ? '' : 'off'} fill={n <= value ? 'currentColor' : 'none'} />)}
    </span>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'blue' }) {
  return (
    <div className="card stat-card">
      <div className={`stat-icon tone-${tone}`}><Icon size={20} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon size={24} /></div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  );
}

export const LoadingBlock = ({ label = 'Loading…' }) => <div className="loading-block"><Spinner /> {label}</div>;

export function ErrorState({ message, onRetry }) {
  return (
    <div className="empty">
      <div className="empty-icon tone-red"><AlertTriangle size={24} /></div>
      <h3>Could not load data</h3>
      <p>{message}</p>
      {onRetry && <div className="mt-16"><button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button></div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="input-group">
      <Search size={16} />
      <input className="input" type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

export function Select({ value, onChange, options, className = '', ...props }) {
  return (
    <select className={`select ${className}`} value={value} onChange={(event) => onChange(event.target.value)} {...props}>
      {options.map((option) => {
        const item = typeof option === 'string' ? { value: option, label: option } : option;
        return <option key={item.value} value={item.value}>{item.label}</option>;
      })}
    </select>
  );
}

export function Field({ label, required, hint, error, children, className = '', htmlFor }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={htmlFor}>{label}{required && <span className="req">*</span>}</label>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value} className={`tab ${value === tab.value ? 'active' : ''}`} onClick={() => onChange(tab.value)}>
          {tab.label}
          {tab.count !== undefined && <span className="count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data table with client-side pagination
// ---------------------------------------------------------------------------
export function Pagination({ page, pages, total, pageSize, onChange }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const windowStart = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, index) => windowStart + index);
  return (
    <div className="pagination">
      <span className="muted small">Showing {from}–{to} of {total}</span>
      <div className="pages">
        <button type="button" className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
        {numbers.map((n) => <button key={n} type="button" className={`page-btn ${n === page ? 'active' : ''}`} onClick={() => onChange(n)}>{n}</button>)}
        <button type="button" className="page-btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

/**
 * columns: [{ key, header, render(row), className, primary }]
 * Rows are paginated client-side (pageSize). Pass `resetKey` to jump back to page 1 when filters change.
 */
export function DataTable({ columns, rows, rowKey = (row) => row._id || row.id, pageSize = 10, empty, resetKey, onRowClick }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setPage(1);
  }
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);

  if (!rows.length) return empty || <EmptyState />;
  return (
    <>
      <div className="table-wrap">
        <table className="table table-responsive">
          <thead>
            <tr>{columns.map((column) => <th key={column.key} className={column.className}>{column.header}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} style={onRowClick ? { cursor: 'pointer' } : undefined}>
                {columns.map((column) => (
                  <td key={column.key} data-label={column.header} className={`${column.className || ''} ${column.primary ? 'cell-primary' : ''}`}>
                    {column.render ? column.render(row) : row[column.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={current} pages={pages} total={rows.length} pageSize={pageSize} onChange={setPage} />
    </>
  );
}

/** Generic loader hook: const { data, loading, error, reload, setData } = useAsync(fn, deps) */
export function useAsync(loader, deps = []) {
  const [tick, setTick] = useState(0);
  const requestKey = JSON.stringify([...deps, tick]);
  // `key` records which request produced the current data, so loading = a newer request is in flight
  const [state, setState] = useState({ data: null, error: '', key: null });
  const loaderRef = useRef(loader);
  useLayoutEffect(() => { loaderRef.current = loader; });

  useEffect(() => {
    let active = true;
    loaderRef.current()
      .then((data) => { if (active) setState({ data, error: '', key: requestKey }); })
      .catch((error) => { if (active) setState((prev) => ({ ...prev, error: error.message || 'Something went wrong.', key: requestKey })); });
    return () => { active = false; };
  }, [requestKey]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater) => setState((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater })), []);
  return { data: state.data, error: state.key === requestKey ? state.error : '', loading: state.key !== requestKey, reload, setData };
}

/** Definition list from [[label, value], ...]; empty values are skipped. */
export function DetailList({ items }) {
  return (
    <dl className="dl">
      {items.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => (
        <Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>
      ))}
    </dl>
  );
}
