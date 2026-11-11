/* eslint-disable react-refresh/only-export-components */
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2, UploadCloud } from 'lucide-react';
import { assetUrl } from '../lib/api';
import { IconButton, Spinner } from './ui';

export const MAX_IMAGE_MB = 5;
export const MAX_IMAGES = 20;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/** Validates picked files; returns { valid, errors } */
export const validateImageFiles = (files, existingCount) => {
  const valid = [];
  const errors = [];
  for (const file of files) {
    if (!ACCEPTED.includes(file.type)) errors.push(`${file.name}: only JPG, PNG or WEBP images are allowed.`);
    else if (file.size > MAX_IMAGE_MB * 1024 * 1024) errors.push(`${file.name}: larger than ${MAX_IMAGE_MB}MB.`);
    else valid.push(file);
  }
  const room = Math.max(0, MAX_IMAGES - existingCount);
  if (valid.length > room) errors.push(`A property can have at most ${MAX_IMAGES} photos; ${valid.length - room} were skipped.`);
  return { valid: valid.slice(0, room), errors };
};

/**
 * Controlled photo manager.
 * items: [{ key, src, pending? }]  (first item = cover)
 * onAdd(files), onRemove(item), onMove(fromIndex, toIndex), onCover(item)
 */
export default function ImageManager({ items, onAdd, onRemove, onMove, onCover, busyKey = '', uploading = false, error }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const pick = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length) onAdd(files);
  };

  return (
    <div>
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(event) => { if (dragIndex === null) { event.preventDefault(); setDrag(true); } }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => { if (dragIndex !== null) return; event.preventDefault(); setDrag(false); pick(event.dataTransfer.files); }}
      >
        {uploading ? <Spinner size={28} /> : <UploadCloud size={30} />}
        <div className="strong">{uploading ? 'Uploading…' : 'Drop photos here or click to browse'}</div>
        <div className="small muted">JPG, PNG or WEBP · up to {MAX_IMAGE_MB}MB each · max {MAX_IMAGES} photos. The first photo is the cover.</div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          multiple
          hidden
          data-testid="property-images-input"
          onChange={(event) => { pick(event.target.files); event.target.value = ''; }}
        />
      </div>
      {error && <div className="field-error mt-8">{error}</div>}

      {items.length > 0 && (
        <div className="image-grid">
          {items.map((item, index) => (
            <div
              key={item.key}
              className={`image-tile ${dragIndex === index ? 'dragging' : ''} ${overIndex === index && dragIndex !== index ? 'drop-target' : ''}`}
              draggable={!busyKey}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => { if (dragIndex !== null) { event.preventDefault(); setOverIndex(index); } }}
              onDrop={(event) => { event.preventDefault(); if (dragIndex !== null && dragIndex !== index) onMove(dragIndex, index); setDragIndex(null); setOverIndex(null); }}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
              data-testid="image-tile"
            >
              <img src={item.pending ? item.src : assetUrl(item.src)} alt={`Property photo ${index + 1}`} />
              {index === 0 && <span className="cover-tag">Cover</span>}
              {item.pending && <span className="pending-tag">Not uploaded yet</span>}
              <div className="image-tools">
                <div className="row" style={{ gap: 0 }}>
                  <IconButton icon={ArrowLeft} label="Move left" disabled={index === 0 || Boolean(busyKey)} onClick={() => onMove(index, index - 1)} />
                  <IconButton icon={ArrowRight} label="Move right" disabled={index === items.length - 1 || Boolean(busyKey)} onClick={() => onMove(index, index + 1)} />
                </div>
                <div className="row" style={{ gap: 0 }}>
                  <IconButton icon={Star} label="Set as cover" disabled={index === 0 || Boolean(busyKey)} onClick={() => onCover(item)} />
                  <IconButton icon={Trash2} label="Remove photo" danger disabled={Boolean(busyKey)} onClick={() => onRemove(item)} />
                </div>
              </div>
              {busyKey === item.key && <div className="busy"><Spinner /></div>}
            </div>
          ))}
          <button type="button" className="image-tile dropzone" style={{ display: 'grid', placeItems: 'center', minHeight: 160, padding: 0 }} onClick={() => inputRef.current?.click()} disabled={uploading}>
            <div><ImagePlus size={24} /><div className="small strong">Add more</div></div>
          </button>
        </div>
      )}
    </div>
  );
}
