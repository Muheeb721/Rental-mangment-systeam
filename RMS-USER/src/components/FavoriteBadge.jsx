import { HeartOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

function FavoriteBadge() {
  const favorites = useSelector((state) => state.auth?.favorites || []);
  const count = Array.isArray(favorites) ? favorites.length : 0;

  return (
    <Link to="/favorites" className="favorite-badge-link">
      <HeartOutlined style={{ fontSize: 18, color: '#28b463' }} />
      {count > 0 && <span className="favorite-badge-count">{count}</span>}
    </Link>
  );
}

export default FavoriteBadge;
