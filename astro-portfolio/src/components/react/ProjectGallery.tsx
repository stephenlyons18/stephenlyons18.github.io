import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

export interface ProjectImage {
  src: string;
  alt: string;
  caption?: string;
}

interface Props {
  images: ProjectImage[];
  /** Unique id per project — used to namespace layoutId values */
  projectId: string;
}

/** Spring config for the expand/collapse animation */
const SPRING = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 26,
  mass: 0.9,
} as const;

export default function ProjectGallery({ images, projectId }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const selected = selectedIdx !== null ? images[selectedIdx] : null;

  // Mark as client-mounted so createPortal is safe to call
  useEffect(() => { setMounted(true); }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIdx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lock body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = selectedIdx !== null ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedIdx]);

  const lightbox = (
    <AnimatePresence>
      {selected !== null && selectedIdx !== null && (
        <>
          {/* Backdrop — full-viewport, closes on click */}
          <motion.div
            key="lightbox-backdrop"
            className="lightbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setSelectedIdx(null)}
            aria-hidden="true"
          />

          {/* Centering shell — pointer-events:none so backdrop receives clicks on desktop */}
          <div
            className="lightbox-centering"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedIdx(null); }}
          >
            <motion.figure
              key={`lightbox-figure-${selectedIdx}`}
              layoutId={`gallery-${projectId}-${selectedIdx}`}
              className="lightbox-figure"
              transition={SPRING}
              style={{ borderRadius: 8, cursor: 'zoom-out' }}
              onClick={() => setSelectedIdx(null)}
              role="dialog"
              aria-modal="true"
              aria-label={selected.alt}
            >
              <img src={selected.src} alt={selected.alt} className="lightbox-img" />
              {selected.caption && (
                <figcaption className="lightbox-caption">{selected.caption}</figcaption>
              )}

              {/* Close button */}
              <motion.button
                className="lightbox-close"
                onClick={(e) => { e.stopPropagation(); setSelectedIdx(null); }}
                aria-label="Close image"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: 0.12, duration: 0.15 }}
              >
                ✕
              </motion.button>
            </motion.figure>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* ── Thumbnail grid ── */}
      <div className="card__images">
        {images.map((img, i) => {
          const id = `gallery-${projectId}-${i}`;
          const isExpanded = selectedIdx === i;
          return (
            <motion.figure
              key={id}
              layoutId={id}
              className="card__image-item"
              onClick={() => setSelectedIdx(i)}
              transition={SPRING}
              style={{
                cursor: 'zoom-in',
                opacity: isExpanded ? 0 : 1,
                borderRadius: 6,
                margin: 0,
              }}
            >
              <img src={img.src} alt={img.alt} loading="lazy" decoding="async" />
              {img.caption && <figcaption>{img.caption}</figcaption>}
            </motion.figure>
          );
        })}
      </div>

      {/* ── Lightbox via portal — renders at document.body, escaping any overflow:hidden parent ── */}
      {mounted && createPortal(lightbox, document.body)}
    </>
  );
}
