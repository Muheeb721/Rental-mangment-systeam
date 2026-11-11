import { motion } from 'framer-motion';

const variants = {
  hidden: (y) => ({ opacity: 0, y }),
  shown: { opacity: 1, y: 0 },
};

/** Fades content up when it scrolls into view. Reduced motion is handled globally by MotionConfig. */
export default function Reveal({ children, delay = 0, y = 18, className, style, amount = 0.15 }) {
  return (
    <motion.div
      className={className}
      style={style}
      custom={y}
      variants={variants}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
