import { HeartOutlined, HeartFilled } from '@ant-design/icons';
import { useFavorites } from '../hooks/useFavorites';
import './FavoriteToggle.css';

function FavoriteToggle({ item, label = 'Favorite' }) {
  const { isFavorited, toggleFavorite } = useFavorites();
  const active = isFavorited(item);

  return (
    <button
      type="button"
      className={`favorite-toggle ${active ? 'active' : ''}`}
      onClick={() => toggleFavorite(item)}
      aria-pressed={active}
    >
      {active ? <HeartFilled /> : <HeartOutlined />}
      <span>{label}</span>
    </button>
  );
}

export default FavoriteToggle;
