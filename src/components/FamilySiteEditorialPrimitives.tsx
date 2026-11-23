import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  Maximize2,
  X,
} from 'lucide-react';
import {
  PublicVaultProjectedItem,
  SanitizedPublicTreeMember,
} from '../services/priority4Service';
import familyWarmthBanner1 from '../assets/images/arab_grandfather_family_warmth_1795434183840.jpg';
import familyWarmthBanner2 from '../assets/images/arab_majlis_generations_gathering_1795434183953.jpg';

export const DEFAULT_HUMAN_INTERLUDE_IMAGES = {
  roots: familyWarmthBanner1,
  kinship: familyWarmthBanner2,
} as const;

export const HUMAN_INTERLUDE_QUOTES = {
  roots: {
    kicker: 'صلة الأجيال وامتداد الدوحة',
    quote:
      'الجذور العميقة لا تشيخ... بل تزهر في عيون الأبناء والأحفاد جيلاً بعد جيل',
  },
  kinship: {
    kicker: 'وفاءٌ للماضي وعهدٌ للمستقبل',
    quote: 'بصلة الرحم تعمر الديار، وبالوفاء تخلد سيرة الأجداد',
  },
} as const;

// =============================================================================
// 1. 2px GOLD SCROLL READING PROGRESS BAR (COMPOSITOR-ONLY 60FPS)
// =============================================================================
export const ScrollProgressGoldBar: React.FC<{ disabled?: boolean }> = ({
  disabled = false,
}) => {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;
    let rafId = 0;
    const updateProgress = () => {
      rafId = 0;
      const docEl = document.documentElement;
      const maxScroll = Math.max(1, docEl.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${ratio})`;
      }
    };
    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateProgress);
      }
    };
    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [disabled]);

  if (disabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[2.5px] bg-transparent overflow-hidden z-40"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-right will-change-transform"
        style={{
          transform: 'scaleX(0)',
          background:
            'linear-gradient(270deg, var(--fs-accent) 0%, var(--fs-gold) 60%, #F2D694 100%)',
        }}
      />
    </div>
  );
};

// =============================================================================
// 2. SMOOTH SCROLL REVEAL WRAPPER (INTERSECTION OBSERVER, REDUCED-MOTION SAFE)
// =============================================================================
export const ScrollRevealChapter: React.FC<{
  children: React.ReactNode;
  delayMs?: number;
  immediate?: boolean;
  className?: string;
}> = ({ children, delayMs = 0, immediate = false, className = '' }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState<boolean>(() => {
    if (immediate) return true;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (visible || immediate) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -48px 0px', threshold: 0.05 }
    );
    observer.observe(node);
    // Safety fallback so content is never permanently hidden
    const fallbackTimer = window.setTimeout(() => setVisible(true), 1200);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, [visible, immediate]);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: visible && delayMs > 0 ? `${delayMs}ms` : '0ms',
      }}
      className={`transition-[transform,opacity] duration-700 ease-out will-change-[transform,opacity] ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  );
};

// =============================================================================
// 3. ANIMATED HERITAGE COUNTER (LIVE COUNT-UP FOR STATS BAR)
// =============================================================================
export const AnimatedHeritageCounter: React.FC<{
  value: number;
  disabled?: boolean;
}> = ({ value, disabled = false }) => {
  const [displayVal, setDisplayVal] = useState<number>(disabled ? value : 0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (disabled || value <= 0) {
      setDisplayVal(value);
      return;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayVal(value);
      return;
    }

    const startAnimation = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const duration = 900;
      const startTime = performance.now();
      const tick = (now: number) => {
        const elapsed = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - elapsed, 3);
        setDisplayVal(Math.max(1, Math.round(eased * value)));
        if (elapsed < 1) {
          requestAnimationFrame(tick);
        } else {
          setDisplayVal(value);
        }
      };
      requestAnimationFrame(tick);
    };

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      startAnimation();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, disabled]);

  return <span ref={ref}>{displayVal}</span>;
};

// =============================================================================
// 4. LARGE ARCHITECTURAL / BOTANICAL SVG WATERMARKS (4%–6% OPACITY)
// =============================================================================
export type EditorialWatermarkType =
  | 'tree'
  | 'compass'
  | 'quill_wave'
  | 'lantern'
  | 'arabesque';

export const HeritageAmbientWatermark: React.FC<{
  variant: EditorialWatermarkType;
  position?: 'left' | 'right' | 'center';
}> = ({ variant, position = 'left' }) => {
  const posClass =
    position === 'right'
      ? '-right-12 -top-8'
      : position === 'center'
        ? 'left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2'
        : '-left-12 -top-8';

  if (variant === 'tree') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 320 320"
        className={`pointer-events-none select-none absolute ${posClass} w-64 h-64 sm:w-80 sm:h-80 opacity-[0.055]`}
        style={{ color: 'var(--fs-accent)' }}
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        >
          <path d="M160 286 C158 232, 162 190, 160 128" />
          <path d="M160 230 C130 205, 102 186, 78 158" />
          <path d="M160 218 C192 192, 218 175, 244 148" />
          <path d="M160 176 C132 148, 114 120, 104 86" />
          <path d="M160 170 C190 144, 212 114, 224 82" />
          <path d="M160 132 C152 102, 155 72, 160 44" />
          <path d="M126 276 C144 268, 176 268, 194 276" />
          <circle cx="78" cy="154" r="14" strokeDasharray="2 3" />
          <circle cx="244" cy="144" r="14" strokeDasharray="2 3" />
          <circle cx="104" cy="82" r="16" />
          <circle cx="224" cy="78" r="16" />
          <circle cx="160" cy="40" r="18" />
          <circle cx="160" cy="128" r="78" strokeWidth="0.7" strokeDasharray="4 6" />
        </g>
      </svg>
    );
  }

  if (variant === 'compass') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 320 320"
        className={`pointer-events-none select-none absolute ${posClass} w-64 h-64 sm:w-80 sm:h-80 opacity-[0.06]`}
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor">
          <circle cx="160" cy="160" r="126" strokeWidth="1.2" />
          <circle cx="160" cy="160" r="96" strokeWidth="0.8" strokeDasharray="4 5" />
          <circle cx="160" cy="160" r="56" strokeWidth="0.8" />
          <path
            d="M160 22 L176 144 L298 160 L176 176 L160 298 L144 176 L22 160 L144 144 Z"
            strokeWidth="1.1"
          />
          <path
            d="M72 72 L150 150 M248 72 L170 150 M248 248 L170 170 M72 248 L150 170"
            strokeWidth="0.8"
          />
        </g>
      </svg>
    );
  }

  if (variant === 'quill_wave') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 320 260"
        className={`pointer-events-none select-none absolute ${posClass} w-64 h-56 sm:w-80 sm:h-64 opacity-[0.055]`}
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <path d="M248 40 C196 52, 134 102, 74 206 C108 184, 152 166, 198 128 C230 100, 246 72, 248 40 Z" />
          <path d="M56 226 C94 180, 158 120, 246 42" />
          <path d="M40 198 Q70 176 100 198 T160 198 T220 198 T280 198" strokeDasharray="3 4" />
          <path d="M60 218 Q90 202 120 218 T180 218 T240 218" strokeWidth="0.8" />
        </g>
      </svg>
    );
  }

  if (variant === 'lantern') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 260 320"
        className={`pointer-events-none select-none absolute ${posClass} w-56 h-64 sm:w-64 sm:h-80 opacity-[0.06]`}
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          <line x1="130" y1="12" x2="130" y2="56" />
          <circle cx="130" cy="64" r="8" />
          <path d="M130 72 C98 92, 82 114, 78 134 H182 C178 114, 162 92, 130 72 Z" />
          <path d="M84 134 L94 238 H166 L176 134" />
          <path d="M130 134 V238" strokeDasharray="3 4" />
          <path d="M108 134 C108 172, 152 172, 152 134" />
          <path d="M94 238 L130 278 L166 238" />
          <circle cx="130" cy="186" r="46" strokeDasharray="2 5" strokeWidth="0.8" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 260"
      className={`pointer-events-none select-none absolute ${posClass} w-60 h-60 opacity-[0.05]`}
      style={{ color: 'var(--fs-gold)' }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="52" y="52" width="156" height="156" />
        <rect
          x="52"
          y="52"
          width="156"
          height="156"
          transform="rotate(45 130 130)"
        />
        <circle cx="130" cy="130" r="108" strokeDasharray="3 5" />
        <circle cx="130" cy="130" r="48" />
      </g>
    </svg>
  );
};

// =============================================================================
// 5. PATTERN A: OPEN EDITORIAL CANVAS (ZERO OUTER WHITE BOX)
// =============================================================================
export const OpenEditorialCanvasSection: React.FC<{
  id: string;
  compactPreview?: boolean;
  watermarkVariant?: EditorialWatermarkType;
  children: React.ReactNode;
}> = ({
  id,
  compactPreview = false,
  watermarkVariant = 'arabesque',
  children,
}) => {
  return (
    <section
      id={id}
      className={`relative scroll-mt-24 overflow-hidden ${
        compactPreview ? 'py-4 px-1' : 'py-8 sm:py-12 px-2 sm:px-4'
      }`}
    >
      <HeritageAmbientWatermark variant={watermarkVariant} position="left" />
      {/* Subtle Horizontal Hairline Crest Above Open Section */}
      <div
        aria-hidden="true"
        className="pointer-events-none mx-auto max-w-4xl mb-6 flex items-center gap-3 opacity-60"
      >
        <div
          className="h-px flex-1"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--fs-gold))',
          }}
        />
        <span className="text-[10px] fs-gold-text">✦</span>
        <div
          className="h-px flex-1"
          style={{
            background:
              'linear-gradient(270deg, transparent, var(--fs-gold))',
          }}
        />
      </div>

      <div className="relative z-10 space-y-6">{children}</div>
    </section>
  );
};

// =============================================================================
// 6. PATTERN B: FULL-BLEED DEEP THEME VELVET BAND (BREAKS IVORY MONOTONY)
// =============================================================================
export const FullBleedVelvetBand: React.FC<{
  id: string;
  compactPreview?: boolean;
  children: React.ReactNode;
}> = ({ id, compactPreview = false, children }) => {
  return (
    <section
      id={id}
      className={`relative scroll-mt-24 overflow-hidden fs-hero ${
        compactPreview
          ? 'rounded-3xl my-4 px-4 py-7'
          : 'w-full py-12 sm:py-16 lg:py-20 my-4'
      }`}
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 50% 0%, color-mix(in srgb, var(--fs-gold) 18%, var(--fs-hero-bg)) 0%, var(--fs-hero-bg) 52%, var(--fs-hero-bg-deep, var(--fs-hero-bg)) 100%)',
      }}
    >
      {/* Top & Bottom Gilded Hairlines */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 5%, var(--fs-gold) 50%, transparent 95%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 5%, var(--fs-gold) 50%, transparent 95%)',
        }}
      />

      {/* Subtle Architectural Filigree Overlay */}
      <svg
        aria-hidden="true"
        viewBox="0 0 360 360"
        className="pointer-events-none select-none absolute -left-16 top-1/2 -translate-y-1/2 w-80 h-80 opacity-[0.07]"
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="180" cy="180" r="154" strokeDasharray="3 6" />
          <circle cx="180" cy="180" r="112" />
          <rect x="92" y="92" width="176" height="176" />
          <rect
            x="92"
            y="92"
            width="176"
            height="176"
            transform="rotate(45 180 180)"
          />
        </g>
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 280 280"
        className="pointer-events-none select-none absolute -right-14 top-8 w-64 h-64 opacity-[0.06]"
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="140" cy="140" r="112" />
          <polygon points="140,26 168,112 254,140 168,168 140,254 112,168 26,140 112,112" />
        </g>
      </svg>

      <div
        className={`relative z-10 ${
          compactPreview ? '' : 'max-w-6xl mx-auto px-4 sm:px-6'
        }`}
      >
        {children}
      </div>
    </section>
  );
};

// =============================================================================
// 7. HUMAN WARMTH CINEMATIC INTERLUDE BANNER (SOFT PARALLAX + FALLBACK)
// =============================================================================
export const HumanWarmthInterludeBanner: React.FC<{
  variant: 'roots' | 'kinship';
  customImageUrl?: string;
  compactPreview?: boolean;
}> = ({ variant, customImageUrl, compactPreview = false }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const imageSrc =
    variant === 'roots' && customImageUrl
      ? customImageUrl
      : DEFAULT_HUMAN_INTERLUDE_IMAGES[variant];
  const copy = HUMAN_INTERLUDE_QUOTES[variant];

  useEffect(() => {
    setImgFailed(false);
  }, [imageSrc]);

  // Smooth 60fps compositor-only scroll parallax
  useEffect(() => {
    if (compactPreview || typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let rafId = 0;
    const updateParallax = () => {
      rafId = 0;
      const el = containerRef.current;
      const bg = bgRef.current;
      if (!el || !bg) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      if (rect.bottom < -120 || rect.top > vh + 120) return;
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
      const offset = Math.max(-22, Math.min(22, progress * -26));
      bg.style.transform = `translate3d(0, ${offset}px, 0) scale(1.12)`;
    };

    const onScroll = () => {
      if (!rafId) rafId = window.requestAnimationFrame(updateParallax);
    };
    updateParallax();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
    };
  }, [compactPreview]);

  return (
    <div
      ref={containerRef}
      data-testid={`human-warmth-interlude-${variant}`}
      className={`relative overflow-hidden rounded-3xl border shadow-[0_18px_46px_-22px_rgba(32,22,14,0.28)] ${
        compactPreview ? 'h-44' : 'h-56 sm:h-64'
      } flex items-center justify-center`}
      style={{
        borderColor: 'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
        background:
          'linear-gradient(135deg, #2A1E15 0%, #4E3420 50%, #241911 100%)',
      }}
    >
      {/* Parallax Editorial Photograph */}
      <div
        ref={bgRef}
        className="absolute inset-0 will-change-transform transition-transform duration-150 ease-out"
        style={{ transform: 'translate3d(0, 0, 0) scale(1.08)' }}
      >
        {!imgFailed && imageSrc ? (
          <img
            src={imageSrc}
            alt={copy.kicker}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover object-center"
            style={{ filter: 'sepia(0.18) saturate(1.08) contrast(1.03)' }}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(circle at 30% 30%, rgba(212,175,106,0.34), transparent 55%), linear-gradient(135deg, var(--fs-hero-bg) 0%, #3E2817 60%, var(--fs-hero-bg-deep, #1C140E) 100%)',
            }}
          />
        )}
      </div>

      {/* Warm Amber Cinematic Contrast Scrim (WCAG AA+ >= 4.5:1) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(24,15,9,0.56) 0%, rgba(36,22,12,0.68) 50%, rgba(20,12,7,0.78) 100%)',
        }}
      />

      {/* Delicate Inner Gilded Frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 rounded-2xl border opacity-35"
        style={{ borderColor: '#E5C481' }}
      />

      {/* Poetic Calligraphic Quote */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 sm:px-10 text-center space-y-2.5 text-[#FFF9EE]">
        <div className="text-[11px] font-bold tracking-wide text-[#F3D299]">
          ✦ {copy.kicker} ✦
        </div>
        <p
          className={`${
            compactPreview
              ? 'text-base leading-relaxed'
              : 'text-lg sm:text-2xl lg:text-[26px] leading-relaxed sm:leading-loose'
          } font-bold fs-display-font text-balance drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]`}
        >
          «{copy.quote}»
        </p>
      </div>
    </div>
  );
};

// =============================================================================
// 8. LIVING FAMILY FACES CONSTELLATION (CIRCULAR GOLD-RINGED MEDALLIONS)
// =============================================================================
function getShortArabicInitial(name?: string): string {
  const cleaned = (name || '')
    .trim()
    .replace(/^(د\.|أ\.|م\.|الشيخ|المهندس|الدكتور|الأستاذ|الحاج)\s+/u, '')
    .trim();
  return (cleaned[0] || 'ع').toUpperCase();
}

export const LivingFamilyConstellation: React.FC<{
  members: SanitizedPublicTreeMember[];
  compactPreview?: boolean;
  tone?: 'dark' | 'light';
}> = ({ members, compactPreview = false, tone = 'dark' }) => {
  const featured = useMemo(() => {
    const withPhotos = members.filter((m) => m.photoThumbnailUrl || m.photoUrl);
    const withoutPhotos = members.filter(
      (m) => !m.photoThumbnailUrl && !m.photoUrl
    );
    const maxItems = compactPreview ? 5 : 9;
    return [...withPhotos, ...withoutPhotos].slice(0, maxItems);
  }, [members, compactPreview]);

  if (featured.length === 0) return null;
  const remainingCount = Math.max(0, members.length - featured.length);
  const isDark = tone === 'dark';

  return (
    <div
      className="relative flex flex-col items-center gap-2.5 w-full py-1"
      aria-label="أجيال ووجوه العائلة المسجلة"
    >
      {/* Delicate curved golden connecting branch behind circular medallions */}
      <div className="relative flex items-center justify-center flex-wrap gap-1.5 sm:gap-2 px-2">
        <svg
          aria-hidden="true"
          viewBox="0 0 600 48"
          preserveAspectRatio="none"
          className="pointer-events-none hidden sm:block absolute inset-x-4 top-1/2 -translate-y-1/2 h-10 w-[calc(100%-2rem)] opacity-55"
        >
          <path
            d="M 10 24 Q 150 6, 300 24 T 590 24"
            fill="none"
            stroke="var(--fs-gold)"
            strokeWidth="1.4"
            strokeDasharray="3 4"
          />
        </svg>

        {featured.map((m, idx) => {
          const photo = m.photoThumbnailUrl || m.photoUrl;
          const label = m.firstName || m.displayName || 'فرد';
          const isCenter = idx === Math.floor(featured.length / 2);
          return (
            <div
              key={m.id}
              title={label}
              className={`relative z-10 flex flex-col items-center transition-transform duration-300 hover:-translate-y-1 ${
                idx % 2 === 1 ? 'mt-2 sm:mt-2.5' : ''
              }`}
            >
              <div
                className={`${
                  isCenter
                    ? 'w-12 h-12 sm:w-14 sm:h-14'
                    : 'w-10 h-10 sm:w-11 sm:h-11'
                } rounded-full p-[2px] shadow-md`}
                style={{
                  background:
                    'linear-gradient(135deg, #F3D999 0%, var(--fs-gold) 55%, var(--fs-accent) 100%)',
                }}
              >
                <div
                  className="w-full h-full rounded-full overflow-hidden flex items-center justify-center font-bold fs-display-font text-xs sm:text-sm"
                  style={{
                    backgroundColor: isDark ? '#251D17' : 'var(--fs-surface)',
                    color: isDark ? '#F6E2B3' : 'var(--fs-accent)',
                  }}
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt={label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getShortArabicInitial(label)}</span>
                  )}
                </div>
              </div>
              {!compactPreview && (
                <span
                  className={`mt-1 text-[10px] font-semibold max-w-[60px] truncate ${
                    isDark ? 'text-[#F8EFE0]/85' : 'fs-muted'
                  }`}
                >
                  {label.split(' ')[0]}
                </span>
              )}
            </div>
          );
        })}

        {remainingCount > 0 && (
          <div className="relative z-10 flex flex-col items-center">
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border flex items-center justify-center text-[11px] font-bold tabular-nums shadow-sm"
              style={{
                borderColor: 'var(--fs-gold)',
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.1)'
                  : 'var(--fs-gold-soft)',
                color: isDark ? '#F3D299' : 'var(--fs-accent)',
              }}
            >
              +{remainingCount}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// 9. TECHNICAL FILENAME SANITIZER FOR PUBLIC VAULT GALLERY
// =============================================================================
const RAW_CAMERA_FILENAME_RE =
  /^(?:img|dsc|dcim|pxl|vid|mov|wa|whatsapp|screenshot|screen[\s_-]?shot|photo|image|pic|file|scan|doc|capture|cam|snap|untitled|copy)[\s_-]*[\d\w.-]*$/i;
const EXTENSION_RE = /\.(jpe?g|png|webp|gif|heic|bmp|tiff?|pdf|svg)$/i;
const HAS_ARABIC_RE = /[\u0600-\u06FF]/;

export function sanitizePublicVaultTitle(
  item: PublicVaultProjectedItem,
  treeMembers: SanitizedPublicTreeMember[],
  familyName: string,
  index: number
): string {
  const raw = (item.title || '').trim();
  const strippedExt = raw.replace(EXTENSION_RE, '').trim();

  // Check if title already contains natural Arabic prose (not raw camera code)
  const looksRawTechnical =
    !strippedExt ||
    RAW_CAMERA_FILENAME_RE.test(strippedExt) ||
    /^[A-Za-z0-9_.\-\s]+$/.test(strippedExt) ||
    /(?:^|[\s_-])(?:dsc|img|pxl|wa\d+|eng|pic|photo)\d*/i.test(strippedExt);

  if (!looksRawTechnical && HAS_ARABIC_RE.test(strippedExt)) {
    return strippedExt;
  }

  // Try matching a family member name inside description or raw filename
  const combinedHint = `${strippedExt} ${item.description || ''}`.toLowerCase();
  const matchedMember = treeMembers.find((m) => {
    const first = (m.firstName || m.displayName || '').trim();
    if (!first || first.length < 2) return false;
    return combinedHint.includes(first.toLowerCase());
  });

  if (matchedMember) {
    const cleanName = (
      matchedMember.firstName || matchedMember.displayName
    ).trim();
    return item.mediaType === 'document'
      ? `وثيقة عائلية — ${cleanName}`
      : `من أرشيف العائلة — ${cleanName}`;
  }

  // Check if Arabic description snippet exists
  const desc = (item.description || '').trim();
  if (desc && HAS_ARABIC_RE.test(desc)) {
    return desc.length > 48 ? `${desc.slice(0, 46)}…` : desc;
  }

  // Try matching member by Arabic transliteration heuristic for common Latin tokens
  if (/aser/i.test(strippedExt)) return 'صورة عائلية — آسر';
  if (/kareem|karim/i.test(strippedExt)) return 'من أرشيف العائلة — كريم';

  // Clean warm heritage fallback (never exposes DSC_7967 or IMG_...)
  if (item.mediaType === 'document') {
    return `وثيقة تراثية محفوظة — أرشيف عائلة ${familyName}`;
  }
  const labels = [
    `لقطة من ذاكرة عائلة ${familyName}`,
    `من ألبوم عائلة ${familyName} التراثي`,
    `صورة عائلية موثقة`,
    `ذكرى محفوظة في خزانة العائلة`,
  ];
  return labels[index % labels.length];
}

// =============================================================================
// 10. CURATED MUSEUM WALL GALLERY & IMMERSIVE LIGHTBOX WITH NAVIGATION
// =============================================================================
export const CuratedMuseumVaultWall: React.FC<{
  items: PublicVaultProjectedItem[];
  treeMembers: SanitizedPublicTreeMember[];
  familyName: string;
  compactPreview?: boolean;
  enablePhotoFacePrompt?: boolean;
  formatArabicLongDate: (raw?: string) => string;
  faceIdOpenItemId: string | null;
  setFaceIdOpenItemId: (id: string | null) => void;
  faceIdSenderName: string;
  setFaceIdSenderName: (v: string) => void;
  faceIdNote: string;
  setFaceIdNote: (v: string) => void;
  onSubmitFaceId: (vaultItemId: string) => void;
}> = ({
  items,
  treeMembers,
  familyName,
  compactPreview = false,
  enablePhotoFacePrompt = false,
  formatArabicLongDate,
  faceIdOpenItemId,
  setFaceIdOpenItemId,
  faceIdSenderName,
  setFaceIdSenderName,
  faceIdNote,
  setFaceIdNote,
  onSubmitFaceId,
}) => {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const sanitizedTitles = useMemo(
    () =>
      items.map((it, idx) =>
        sanitizePublicVaultTitle(it, treeMembers, familyName, idx)
      ),
    [items, treeMembers, familyName]
  );

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (lightboxIdx === null || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowLeft') {
        setLightboxIdx((cur) =>
          cur === null ? null : (cur + 1) % items.length
        );
      }
      if (e.key === 'ArrowRight') {
        setLightboxIdx((cur) =>
          cur === null ? null : (cur - 1 + items.length) % items.length
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, items.length]);

  const activeLightboxItem =
    lightboxIdx !== null ? items[lightboxIdx] || null : null;
  const activeLightboxTitle =
    lightboxIdx !== null ? sanitizedTitles[lightboxIdx] || '' : '';

  // Asymmetric Bento span pattern for Editorial Museum Wall
  const getWallItemClass = (idx: number, total: number): string => {
    if (compactPreview) return 'col-span-1';
    if (total === 1) return 'md:col-span-12';
    if (total === 2) {
      return idx === 0 ? 'md:col-span-7' : 'md:col-span-5';
    }
    if (total === 3) {
      return idx === 0 ? 'md:col-span-7 md:row-span-2' : 'md:col-span-5';
    }
    // 4+ items: rhythmic asymmetric editorial masonry
    const mod = idx % 4;
    if (mod === 0) return 'md:col-span-7';
    if (mod === 1) return 'md:col-span-5';
    if (mod === 2) return 'md:col-span-5';
    return 'md:col-span-7';
  };

  const getTiltHoverClass = (idx: number): string => {
    if (compactPreview) return '';
    return idx % 2 === 0
      ? 'hover:-rotate-[0.65deg] hover:-translate-y-1'
      : 'hover:rotate-[0.65deg] hover:-translate-y-1';
  };

  return (
    <>
      <div
        className={`grid ${
          compactPreview
            ? 'grid-cols-1 gap-4'
            : 'grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 items-stretch'
        }`}
        data-testid="curated-museum-vault-wall"
      >
        {items.map((item, idx) => {
          const cleanTitle = sanitizedTitles[idx];
          const isLeadFeatured =
            !compactPreview && (items.length === 1 || (items.length === 3 && idx === 0));
          const dateText = formatArabicLongDate(item.dateOrOccasion);

          return (
            <article
              key={item.id}
              className={`${getWallItemClass(idx, items.length)} ${getTiltHoverClass(idx)} group rounded-2xl bg-[#FFFDF8] border p-3 sm:p-3.5 shadow-[0_12px_32px_-16px_rgba(32,22,14,0.22)] hover:shadow-[0_22px_44px_-18px_rgba(32,22,14,0.3)] transition-all duration-300 ease-out flex flex-col justify-between`}
              style={{
                borderColor:
                  'color-mix(in srgb, var(--fs-gold) 42%, transparent)',
              }}
            >
              {/* Museum Matting Inner Photo Frame */}
              <div
                onClick={() => !compactPreview && setLightboxIdx(idx)}
                className={`relative rounded-xl overflow-hidden fs-surface-alt border cursor-pointer flex items-center justify-center ${
                  isLeadFeatured
                    ? 'aspect-[16/10] md:h-full md:min-h-[340px]'
                    : items.length === 2 && idx === 0 && !compactPreview
                      ? 'aspect-[16/10]'
                      : 'aspect-[4/3]'
                }`}
                style={{
                  borderColor:
                    'color-mix(in srgb, var(--fs-gold) 26%, transparent)',
                }}
              >
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={cleanTitle}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                ) : (
                  <FileText className="w-10 h-10 fs-accent-text opacity-60" />
                )}

                {/* Subtle Warm Vignette */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"
                />

                {item.watermarkText && (
                  <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-md bg-black/50 backdrop-blur-xs text-[10px] text-white/90 font-semibold pointer-events-none">
                    {item.watermarkText}
                  </div>
                )}

                {!compactPreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIdx(idx);
                    }}
                    title="تكبير في العارض المتحفي"
                    className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/55 hover:bg-black/80 text-[#F6E2B3] border border-[#E5C481]/45 flex items-center justify-center opacity-85 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-md"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Artisanal Polaroid / Museum Caption Plaque */}
              <div className="pt-3.5 px-1.5 pb-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-[10.5px] font-bold fs-accent-text">
                      {item.mediaType === 'document'
                        ? 'وثيقة أرشيفية'
                        : 'من ألبوم العائلة'}
                      {dateText ? ` · ${dateText}` : ''}
                    </div>
                    <h3 className="text-sm sm:text-[15px] font-bold fs-display-font text-[#241B14] leading-snug line-clamp-2">
                      {cleanTitle}
                    </h3>
                  </div>
                </div>

                {enablePhotoFacePrompt && !compactPreview && (
                  <div className="pt-2.5 border-t fs-border space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFaceIdOpenItemId(
                          faceIdOpenItemId === item.id ? null : item.id
                        )
                      }
                      className="text-[11px] font-bold fs-accent-text hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>
                        هل تعرف شخصاً في هذه الصورة؟ (
                        {item.faceIdNotes?.length || 0})
                      </span>
                    </button>
                    {faceIdOpenItemId === item.id && (
                      <div className="space-y-1.5 pt-1">
                        <input
                          type="text"
                          value={faceIdSenderName}
                          onChange={(e) => setFaceIdSenderName(e.target.value)}
                          placeholder="اسمك الكريم"
                          className="w-full px-2.5 py-1.5 rounded-lg fs-surface-alt border fs-border text-xs"
                        />
                        <input
                          type="text"
                          value={faceIdNote}
                          onChange={(e) => setFaceIdNote(e.target.value)}
                          placeholder="مثال: الواقف يميناً هو الجد..."
                          className="w-full px-2.5 py-1.5 rounded-lg fs-surface-alt border fs-border text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => onSubmitFaceId(item.id)}
                          className="w-full py-1.5 rounded-lg fs-accent-bg text-xs font-bold cursor-pointer"
                        >
                          إرسال التعريف
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* IMMERSIVE FULLSCREEN LIGHTBOX MODAL WITH NEXT/PREV NAVIGATION */}
      {activeLightboxItem && !compactPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeLightboxTitle}
          className="fixed inset-0 z-[80] bg-[#120E0B]/92 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxIdx(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl rounded-3xl bg-[#1C1612] border overflow-hidden shadow-2xl flex flex-col"
            style={{
              borderColor: 'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
            }}
          >
            {/* Top Bar */}
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 text-[#FAF5EB]">
              <div className="text-xs font-bold text-[#F3D299] tabular-nums">
                مقتنى {(lightboxIdx ?? 0) + 1} من {items.length}
              </div>
              <button
                type="button"
                onClick={() => setLightboxIdx(null)}
                aria-label="إغلاق العارض"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Image Stage with Prev/Next Navigation */}
            <div className="relative bg-[#110D0A] flex items-center justify-center p-4 sm:p-6 min-h-[45vh] max-h-[68vh]">
              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="الصورة السابقة"
                    onClick={() =>
                      setLightboxIdx((cur) =>
                        cur === null
                          ? 0
                          : (cur - 1 + items.length) % items.length
                      )
                    }
                    className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 border border-[#E5C481]/45 text-[#F6E2B3] flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="الصورة التالية"
                    onClick={() =>
                      setLightboxIdx((cur) =>
                        cur === null ? 0 : (cur + 1) % items.length
                      )
                    }
                    className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 border border-[#E5C481]/45 text-[#F6E2B3] flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </>
              )}

              {activeLightboxItem.previewUrl ? (
                <img
                  src={activeLightboxItem.previewUrl}
                  alt={activeLightboxTitle}
                  referrerPolicy="no-referrer"
                  className="max-h-[62vh] w-auto object-contain rounded-xl shadow-2xl"
                />
              ) : (
                <FileText className="w-16 h-16 text-[#E5C481]" />
              )}
            </div>

            {/* Caption Footer */}
            <div className="px-6 py-4 bg-[#1C1612] border-t border-white/10 text-[#FAF5EB] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold fs-display-font">
                  {activeLightboxTitle}
                </h3>
                <div className="text-xs text-[#FAF5EB]/70 mt-0.5 tabular-nums">
                  {formatArabicLongDate(activeLightboxItem.dateOrOccasion)}
                  {activeLightboxItem.watermarkText
                    ? ` · ${activeLightboxItem.watermarkText}`
                    : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
