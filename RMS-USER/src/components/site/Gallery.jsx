import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { LuChevronLeft, LuChevronRight, LuGrid2X2, LuX } from 'react-icons/lu';
import Img from './Img';

function Lightbox({ images, start, onClose, title }) {
  const [emblaRef, embla] = useEmblaCarousel({ startIndex: start, loop: images.length > 1 });
  const [index, setIndex] = useState(start);

  useEffect(() => {
    if (!embla) return undefined;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', onSelect);
    return () => { embla.off('select', onSelect); };
  }, [embla]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') embla?.scrollNext();
      if (e.key === 'ArrowLeft') embla?.scrollPrev();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [embla, onClose]);

  return (
    <motion.div className="g-lightbox" role="dialog" aria-modal="true" aria-label={`${title} photos`} data-lenis-prevent initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="g-lightbox__top">
        <span>{index + 1} / {images.length}</span>
        <strong>{title}</strong>
        <button type="button" className="g-lightbox__btn" onClick={onClose} aria-label="Close gallery"><LuX size={22} /></button>
      </div>
      <div className="g-lightbox__stage">
        <div className="g-lightbox__viewport" ref={emblaRef}>
          <div className="g-lightbox__track">
            {images.map((src, i) => (
              <div className="g-lightbox__slide" key={src}>
                <img src={src} alt={`${title} — photo ${i + 1}`} loading={Math.abs(i - start) < 2 ? 'eager' : 'lazy'} />
              </div>
            ))}
          </div>
        </div>
        {images.length > 1 ? (
          <>
            <button type="button" className="g-lightbox__btn g-lightbox__nav is-prev" onClick={() => embla?.scrollPrev()} aria-label="Previous photo"><LuChevronLeft size={26} /></button>
            <button type="button" className="g-lightbox__btn g-lightbox__nav is-next" onClick={() => embla?.scrollNext()} aria-label="Next photo"><LuChevronRight size={26} /></button>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="g-lightbox__thumbs">
          {images.map((src, i) => (
            <button key={src} type="button" className={i === index ? 'is-active' : ''} onClick={() => embla?.scrollTo(i)} aria-label={`Show photo ${i + 1}`}>
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

function MobileSlider({ images, title, onOpen }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: images.length > 1 });
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!embla) return undefined;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', onSelect);
    return () => { embla.off('select', onSelect); };
  }, [embla]);
  return (
    <div className="g-mobile">
      <div className="g-mobile__viewport" ref={emblaRef}>
        <div className="g-mobile__track">
          {images.map((src, i) => (
            <button type="button" className="g-mobile__slide" key={src} onClick={() => onOpen(i)} aria-label={`Open photo ${i + 1}`}>
              <Img src={src} alt={`${title} — photo ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} />
            </button>
          ))}
        </div>
      </div>
      <span className="r-badge r-badge--dark g-mobile__count">{index + 1} / {images.length}</span>
    </div>
  );
}

/** Photo mosaic (desktop) / swipe slider (mobile) with a full-screen lightbox. */
export default function Gallery({ images = [], title = 'Property' }) {
  const [open, setOpen] = useState(-1);
  const close = useCallback(() => setOpen(-1), []);

  if (!images.length) {
    return (
      <div className="g-empty"><Img src="" alt={title} label="Photos for this listing are being updated" /></div>
    );
  }

  const tiles = images.slice(0, 5);
  return (
    <>
      <div className={`g-mosaic g-mosaic--${Math.min(tiles.length, 5)}`}>
        {tiles.map((src, i) => (
          <button key={src} type="button" className={`g-tile ${i === 0 ? 'is-main' : ''}`} onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1}`}>
            <Img src={src} alt={i === 0 ? title : ''} loading={i === 0 ? 'eager' : 'lazy'} />
          </button>
        ))}
        <button type="button" className="r-btn r-btn--sm g-all" onClick={() => setOpen(0)}><LuGrid2X2 size={15} /> Show all {images.length} photo{images.length > 1 ? 's' : ''}</button>
      </div>
      <MobileSlider images={images} title={title} onOpen={setOpen} />
      {createPortal(
        <AnimatePresence>{open >= 0 && <Lightbox images={images} start={open} onClose={close} title={title} />}</AnimatePresence>,
        document.body,
      )}
    </>
  );
}
