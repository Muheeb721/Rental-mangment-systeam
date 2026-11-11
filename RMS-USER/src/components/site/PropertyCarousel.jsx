import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import PropertyCard from './PropertyCard';

export default function PropertyCarousel({ items = [] }) {
  const [emblaRef, embla] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: false });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    if (!embla) return;
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
  }, [embla]);

  useEffect(() => {
    if (!embla) return undefined;
    update();
    embla.on('select', update);
    embla.on('reInit', update);
    return () => { embla.off('select', update); embla.off('reInit', update); };
  }, [embla, update]);

  return (
    <div className="r-carousel">
      <div className="r-carousel__viewport" ref={emblaRef}>
        <div className="r-carousel__track">
          {items.map((p) => (
            <div className="r-carousel__slide" key={p.id}><PropertyCard property={p} /></div>
          ))}
        </div>
      </div>
      <div className="r-carousel__nav">
        <button type="button" className="r-btn r-btn--icon" onClick={() => embla?.scrollPrev()} disabled={!canPrev} aria-label="Previous properties"><LuChevronLeft size={20} /></button>
        <button type="button" className="r-btn r-btn--icon" onClick={() => embla?.scrollNext()} disabled={!canNext} aria-label="Next properties"><LuChevronRight size={20} /></button>
      </div>
    </div>
  );
}
