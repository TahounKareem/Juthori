import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { normalizeExternalImageUrl } from '../services/firestoreService';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const normalizedSrc = normalizeExternalImageUrl(src || '');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [normalizedSrc]);

  if (hasError || !normalizedSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#EDE6DA] via-[#E5DBCA] to-[#D8755B]/25 text-[#252321] p-6 text-center ${className}`}
      >
        <BookOpen className="w-8 h-8 text-[#D8755B] mb-2" aria-hidden="true" />
        <span className="text-sm font-medium text-[#252321]/80 line-clamp-2">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  const isRemoteHttp = /^https?:\/\//i.test(normalizedSrc);

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      referrerPolicy={isRemoteHttp ? 'no-referrer' : undefined}
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};

