const Toast = ({ toast }) => {
  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.variant || 'success'}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
    </div>
  );
};

export default Toast;
