import { motion } from 'framer-motion';
import { LuHeart } from 'react-icons/lu';
import { useFavoriteIds } from '../../hooks/useFavoriteIds';

export default function FavoriteButton({ id, variant = 'float', size = 18 }) {
  const { isFavorite, toggle } = useFavoriteIds();
  const on = isFavorite(id);
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      className={`r-favbtn ${variant === 'outline' ? 'r-favbtn--outline' : ''} ${on ? 'is-on' : ''}`}
      aria-pressed={on}
      aria-label={on ? 'Remove from saved homes' : 'Save this home'}
      title={on ? 'Saved' : 'Save'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id); }}
    >
      <LuHeart size={size} fill={on ? 'currentColor' : 'none'} />
    </motion.button>
  );
}
