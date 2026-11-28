import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { normalizeExternalImageUrl } from '../services/firestoreService';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  fallbackSrc?: string;
  loading?: 'lazy' | 'eager';
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
  fallbackSrc,
  loading = 'lazy',
}) => {
  const normalizedSrc = normalizeExternalImageUrl(src || '');
  const normalizedFallback = normalizeExternalImageUrl(fallbackSrc || '');
  const [usedFallback, setUsedFallback] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setUsedFallback(false);
    setHasError(false);
  }, [normalizedSrc, normalizedFallback]);

  const activeSrc = usedFallback ? normalizedFallback : normalizedSrc;

  if (hasError || !activeSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#E8DED2] via-[#E8DED2] to-[#D97757]/25 text-[#1F1F1C] p-6 text-center ${className}`}
      >
        <BookOpen className="w-8 h-8 text-[#D97757] mb-2" aria-hidden="true" />
        <span className="text-sm font-medium text-[#1F1F1C]/80 line-clamp-2">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  const isRemoteHttp = /^https?:\/\//i.test(activeSrc);

  return (
    <img
      src={activeSrc}
      alt={alt}
      referrerPolicy={isRemoteHttp ? 'no-referrer' : undefined}
      loading={loading}
      decoding="async"
      onError={() => {
        if (!usedFallback && normalizedFallback && normalizedFallback !== normalizedSrc) {
          setUsedFallback(true);
        } else {
          setHasError(true);
        }
      }}
      className={className}
    />
  );
};

