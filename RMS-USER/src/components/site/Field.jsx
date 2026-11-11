/** Labelled form field with inline error/hint. Pass `as="select"|"textarea"` for other controls. */
export default function Field({ label, error, hint, as = 'input', className = '', children, id, ...props }) {
  const fieldId = id || `f-${props.name || label?.toString().toLowerCase().replace(/\W+/g, '-')}`;
  const cls = { input: 'r-input', select: 'r-select', textarea: 'r-textarea' }[as];
  const Control = as;
  return (
    <div className={`r-field ${className}`}>
      {label ? <label className="r-label" htmlFor={fieldId}>{label}</label> : null}
      <Control id={fieldId} className={`${cls} ${error ? 'has-error' : ''}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-err` : undefined} {...props}>
        {children}
      </Control>
      {error ? <span className="r-error" id={`${fieldId}-err`} role="alert">{error}</span> : hint ? <span className="r-hint">{hint}</span> : null}
    </div>
  );
}
