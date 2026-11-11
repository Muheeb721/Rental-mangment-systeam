import { LuSearch } from 'react-icons/lu';

export default function EmptyState({ icon: Icon = LuSearch, title, children, action }) {
  return (
    <div className="r-empty">
      <div className="r-empty__icon"><Icon size={24} /></div>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action || null}
    </div>
  );
}
