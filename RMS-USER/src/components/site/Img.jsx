import { useState } from 'react';
import { LuImage } from 'react-icons/lu';

/** Image with graceful fallback when the source is missing or fails to load. */
export default function Img({ src, alt = '', label = 'Photos coming soon', className, style, loading = 'lazy', ...rest }) {
  const [failedSrc, setFailedSrc] = useState('');
  if (!src || failedSrc === src) {
    return (
      <div className="r-imgfb" role="img" aria-label={alt || label} style={style}>
        <div><LuImage size={26} /><span>{label}</span></div>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} style={style} loading={loading} decoding="async" onError={() => setFailedSrc(src)} {...rest} />;
}
