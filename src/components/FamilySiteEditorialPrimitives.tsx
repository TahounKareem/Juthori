import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  Maximize2,
  Pause,
  Play,
  Volume2,
  X,
} from 'lucide-react';
import {
  EmotionalInterludeConfig,
  EmotionalInterludePosition,
  EmotionalInterludePresetId,
  PublicVaultProjectedItem,
  SanitizedPublicTreeMember,
} from '../services/priority4Service';
import familyWarmthScene1 from '../assets/images/arab_grandfather_family_warmth_1795434183840.jpg';
import familyWarmthScene2 from '../assets/images/arab_majlis_generations_gathering_1795434183953.jpg';
import familyWarmthScene3 from '../assets/images/arab_heritage_courtyard_family_1795436709205.jpg';
import familyWarmthScene4 from '../assets/images/arab_hands_heirloom_manuscript_1795436709026.jpg';

// =============================================================================
// CURATED EMOTIONAL INTERLUDE PRESETS (4 WARM HUMAN HERITAGE SCENES)
// =============================================================================
export const EMOTIONAL_INTERLUDE_PRESETS: Array<{
  id: EmotionalInterludePresetId;
  label: string;
  subtitle: string;
  imageUrl: string;
}> = [
  {
    id: 'grandfather_warmth',
    label: 'دفء الجد والأحفاد',
    subtitle: 'عناق الأجيال وامتداد البركة',
    imageUrl: familyWarmthScene1,
  },
  {
    id: 'majlis_gathering',
    label: 'جلسة الديوان العائلي',
    subtitle: 'قهوة عربية وأنس الأهل',
    imageUrl: familyWarmthScene2,
  },
  {
    id: 'courtyard_olive',
    label: 'فناء شجرة الزيتون',
    subtitle: 'اجتماع الأسرة تحت الظل التراثي',
    imageUrl: familyWarmthScene3,
  },
  {
    id: 'heirloom_hands',
    label: 'سجل الذكريات الموروث',
    subtitle: 'أيدي الأجداد تسلم الراية للأبناء',
    imageUrl: familyWarmthScene4,
  },
];

export const EMOTIONAL_INTERLUDE_POSITION_OPTIONS: Array<{
  id: EmotionalInterludePosition;
  label: string;
  description: string;
}> = [
  {
    id: 'after_tree',
    label: 'بعد بوابة دوحة النسب',
    description: 'وقفة دافئة تلي استعراض شجرة العائلة',
  },
  {
    id: 'after_welcome_atlas',
    label: 'بعد الاستقبال وأطلس الديار',
    description: 'تظهر مبكراً بعد كلمة العميد والديار',
  },
  {
    id: 'after_vault',
    label: 'بعد معرض الخزانة والصور',
    description: 'تتوسط الذكريات المصورة وبقية الفصول',
  },
  {
    id: 'before_memorial',
    label: 'قبل ركن الوفاء والدعاء',
    description: 'تمهيد وجداني مؤثر قبل ركن الوفاء',
  },
];

export const EMOTIONAL_INTERLUDE_QUOTE_SUGGESTIONS: Array<{
  id: string;
  kicker: string;
  quote: string;
}> = [
  {
    id: 'roots_bloom',
    kicker: 'صلة الأجيال وامتداد الدوحة',
    quote:
      'الجذور العميقة لا تشيخ... بل تزهر في عيون الأبناء والأحفاد جيلاً بعد جيل',
  },
  {
    id: 'kinship_homes',
    kicker: 'وفاءٌ للماضي وعهدٌ للمستقبل',
    quote: 'بصلة الرحم تعمر الديار، وبالوفاء تخلد سيرة الأجداد في قلوب الأحفاد',
  },
  {
    id: 'memory_trust',
    kicker: 'أمانة الذكرى وعطر الأثر',
    quote:
      'ما يجمع العائلة ليس الاسم وحده... بل الحكايات التي تُروى في الديوان والقلوب التي لا تنسى',
  },
  {
    id: 'olive_legacy',
    kicker: 'عراقة الدار وبركة الأصل',
    quote:
      'كشجرةٍ طيبةٍ أصلها ثابت وفرعها في السماء... هكذا تمضي عائلتنا متماسكة عبر السنين',
  },
];

export function resolveEmotionalInterludeImage(
  config: EmotionalInterludeConfig
): string {
  if (config.customImageUrl) return config.customImageUrl;
  const preset = EMOTIONAL_INTERLUDE_PRESETS.find(
    (p) => p.id === config.imagePresetId
  );
  return preset?.imageUrl || EMOTIONAL_INTERLUDE_PRESETS[0].imageUrl;
}

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
    const fallbackTimer = window.setTimeout(() => setVisible(true), 1100);
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
// 4. BESPOKE SECTION-SPECIFIC ARCHITECTURAL & SUBJECT SVG WATERMARKS
// =============================================================================
export type EditorialWatermarkType =
  | 'tree'
  | 'quill_inkwell'
  | 'topographic_map'
  | 'storybook_open'
  | 'gallery_frames'
  | 'acoustic_oud'
  | 'festive_chandelier'
  | 'mihrab_lantern'
  | 'arabesque';

export const HeritageAmbientWatermark: React.FC<{
  variant: EditorialWatermarkType;
  position?: 'left' | 'right' | 'center';
  opacityClass?: string;
}> = ({ variant, position = 'left', opacityClass }) => {
  const posClass =
    position === 'right'
      ? '-right-10 -top-6'
      : position === 'center'
        ? 'left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2'
        : '-left-10 -top-6';

  if (variant === 'quill_inkwell') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 320 260"
        className={`pointer-events-none select-none absolute ${posClass} w-56 h-48 sm:w-72 sm:h-56 ${opacityClass || 'opacity-[0.075]'}`}
        style={{ color: 'var(--fs-gold)' }}
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Calligrapher's Quill Feather */}
          <path d="M254 28 C210 38, 152 84, 108 168 C144 150, 186 128, 224 90 C244 68, 254 48, 254 28 Z" />
          <path d="M90 194 C132 146, 188 92, 252 30" />
          <path d="M188 70 L204 86 M162 96 L178 112 M138 126 L152 140" strokeWidth="0.85" />
          {/* Antique Brass Inkwell */}
          <path d="M72 198 H128 L138 232 C138 238, 132 242, 124 242 H76 C68 242, 62 238, 62 232 Z" />
          <rect x="84" y="184" width="32" height="14" rx="3" />
          <path d="M44 242 H158" strokeDasharray="3 5" strokeWidth="0.9" />
        </g>
      </svg>
    );
  }

  if (variant === 'topographic_map') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 640 340"
        preserveAspectRatio="xMidYMid slice"
        className={`pointer-events-none select-none absolute inset-0 w-full h-full ${opacityClass || 'opacity-[0.085]'}`}
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor">
          {/* Coordinate Lat/Long Grid */}
          <path
            d="M0 70 H640 M0 170 H640 M0 270 H640 M140 0 V340 M320 0 V340 M500 0 V340"
            strokeWidth="0.6"
            strokeDasharray="4 7"
            opacity="0.55"
          />
          {/* Organic Topographic Contour Rings */}
          <path
            d="M-20 260 C70 210, 140 245, 220 195 C300 145, 390 190, 490 135 C560 95, 610 110, 660 80"
            strokeWidth="1.15"
          />
          <path
            d="M-20 295 C85 245, 160 275, 245 225 C325 180, 415 220, 515 168 C580 132, 620 140, 660 115"
            strokeWidth="0.9"
          />
          <path
            d="M10 195 C95 145, 175 170, 260 115 C340 65, 420 110, 520 55"
            strokeWidth="0.85"
            strokeDasharray="5 5"
          />
          <ellipse cx="145" cy="110" rx="74" ry="42" strokeWidth="0.85" />
          <ellipse cx="145" cy="110" rx="44" ry="24" strokeWidth="0.7" />
          {/* Cartographic Compass Rose (Left Corner) */}
          <g transform="translate(88 232)">
            <circle cx="0" cy="0" r="56" strokeWidth="1" />
            <circle cx="0" cy="0" r="42" strokeWidth="0.7" strokeDasharray="3 4" />
            <path
              d="M0 -64 L9 -9 L64 0 L9 9 L0 64 L-9 9 L-64 0 L-9 -9 Z"
              strokeWidth="1.05"
            />
            <path d="M-34 -34 L34 34 M34 -34 L-34 34" strokeWidth="0.7" />
          </g>
        </g>
      </svg>
    );
  }

  if (variant === 'storybook_open') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 360 240"
        className={`pointer-events-none select-none absolute ${posClass} w-64 h-48 sm:w-80 sm:h-56 ${opacityClass || 'opacity-[0.065]'}`}
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <path d="M180 56 C142 40, 88 38, 42 52 V194 C88 180, 142 182, 180 198 C218 182, 272 180, 318 194 V52 C272 38, 218 40, 180 56 Z" />
          <line x1="180" y1="56" x2="180" y2="198" />
          <path d="M68 84 H152 M68 106 H148 M68 128 H144 M68 150 H136" strokeWidth="0.85" strokeDasharray="3 4" />
          <path d="M208 84 H292 M208 106 H288 M208 128 H282 M208 150 H272" strokeWidth="0.85" strokeDasharray="3 4" />
          <path d="M250 18 C222 30, 198 54, 186 82 C208 72, 232 54, 250 18 Z" />
        </g>
      </svg>
    );
  }

  if (variant === 'gallery_frames') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 360 260"
        className={`pointer-events-none select-none absolute ${posClass} w-64 h-48 sm:w-80 sm:h-60 ${opacityClass || 'opacity-[0.06]'}`}
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.15">
          {/* Vintage Museum Gallery Frame Pair */}
          <rect x="34" y="34" width="136" height="106" rx="6" />
          <rect x="44" y="44" width="116" height="86" rx="3" strokeDasharray="3 4" />
          <rect x="148" y="96" width="166" height="122" rx="6" />
          <rect x="160" y="108" width="142" height="98" rx="3" />
          {/* Film Sprocket Strip Accent */}
          <path d="M40 176 H134 M40 214 H134" strokeWidth="1" />
          <rect x="50" y="182" width="10" height="8" rx="1.5" />
          <rect x="74" y="182" width="10" height="8" rx="1.5" />
          <rect x="98" y="182" width="10" height="8" rx="1.5" />
          <rect x="50" y="200" width="10" height="8" rx="1.5" />
          <rect x="74" y="200" width="10" height="8" rx="1.5" />
          <rect x="98" y="200" width="10" height="8" rx="1.5" />
        </g>
      </svg>
    );
  }

  if (variant === 'acoustic_oud') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 380 260"
        className={`pointer-events-none select-none absolute ${posClass} w-64 h-48 sm:w-80 sm:h-56 ${opacityClass || 'opacity-[0.09]'}`}
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          {/* Classical Oud Pear Body & Rosette */}
          <path d="M126 198 C86 198, 66 162, 74 126 C82 90, 112 72, 134 52 C156 72, 186 90, 194 126 C202 162, 182 198, 142 198 Z" />
          <circle cx="134" cy="130" r="20" strokeDasharray="3 3" />
          <circle cx="134" cy="130" r="10" />
          <line x1="134" y1="52" x2="134" y2="12" strokeWidth="3.5" />
          <line x1="118" y1="168" x2="150" y2="168" strokeWidth="2" />
          {/* Acoustic Concentric Soundwaves */}
          <path d="M224 96 Q246 130 224 164" />
          <path d="M248 76 Q280 130 248 184" strokeDasharray="4 4" />
          <path d="M276 56 Q316 130 276 204" strokeWidth="0.9" />
        </g>
      </svg>
    );
  }

  if (variant === 'festive_chandelier') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 340 240"
        className={`pointer-events-none select-none absolute ${posClass} w-64 h-48 sm:w-80 sm:h-56 ${opacityClass || 'opacity-[0.07]'}`}
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round">
          {/* Festive Garlands & Hanging Lanterns */}
          <path d="M16 28 Q170 96 324 28" strokeDasharray="4 4" />
          <line x1="94" y1="58" x2="94" y2="104" />
          <path d="M94 104 L76 124 L82 168 H106 L112 124 Z" />
          <line x1="170" y1="62" x2="170" y2="122" />
          <path d="M170 122 L144 148 L152 204 H188 L196 148 Z" />
          <circle cx="170" cy="168" r="10" strokeDasharray="2 3" />
          <line x1="246" y1="58" x2="246" y2="104" />
          <path d="M246 104 L228 124 L234 168 H258 L264 124 Z" />
        </g>
      </svg>
    );
  }

  if (variant === 'mihrab_lantern') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 280 340"
        className={`pointer-events-none select-none absolute ${posClass} w-56 h-64 sm:w-64 sm:h-80 ${opacityClass || 'opacity-[0.075]'}`}
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          {/* Hanging Illuminated Lantern */}
          <line x1="140" y1="8" x2="140" y2="54" />
          <circle cx="140" cy="62" r="7" />
          <path d="M140 70 C106 88, 90 112, 86 134 H194 C190 112, 174 88, 140 70 Z" />
          <path d="M92 134 L102 232 H178 L188 134" />
          <path d="M116 134 C116 178, 164 178, 164 134" />
          <path d="M102 232 L140 272 L178 232" />
          {/* Radiant Halo & Olive Branches */}
          <circle cx="140" cy="182" r="52" strokeDasharray="3 6" strokeWidth="0.85" />
          <path d="M46 286 C80 264, 110 266, 134 294" />
          <path d="M234 286 C200 264, 170 266, 146 294" />
          <ellipse cx="78" cy="264" rx="10" ry="4" transform="rotate(-24 78 264)" />
          <ellipse cx="202" cy="264" rx="10" ry="4" transform="rotate(24 202 264)" />
        </g>
      </svg>
    );
  }

  if (variant === 'tree') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 320 320"
        className={`pointer-events-none select-none absolute ${posClass} w-64 h-64 sm:w-80 sm:h-80 ${opacityClass || 'opacity-[0.06]'}`}
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
          <circle cx="78" cy="154" r="14" strokeDasharray="2 3" />
          <circle cx="244" cy="144" r="14" strokeDasharray="2 3" />
          <circle cx="104" cy="82" r="16" />
          <circle cx="224" cy="78" r="16" />
          <circle cx="160" cy="40" r="18" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 260"
      className={`pointer-events-none select-none absolute ${posClass} w-60 h-60 ${opacityClass || 'opacity-[0.055]'}`}
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
// 4B. AUTO-DETECTED GUILD SPECIALTY WATERMARK FOR PROFESSIONS CARDS
// =============================================================================
export const GuildSpecialtyWatermark: React.FC<{
  fieldCategory?: string;
  specialty?: string;
}> = ({ fieldCategory = '', specialty = '' }) => {
  const text = `${fieldCategory} ${specialty}`.toLowerCase();

  // Medical / Healthcare: Stethoscope
  if (/طب|طبيب|صيدل|جراح|صح|أسنان|تمريض|علاج|medic|doctor|health/i.test(text)) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 180 180"
        className="pointer-events-none select-none absolute -left-5 -bottom-5 w-36 h-36 opacity-[0.085]"
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M44 36 V78 C44 106, 66 124, 90 124 C114 124, 136 106, 136 78 V36" />
          <circle cx="44" cy="30" r="6" />
          <circle cx="136" cy="30" r="6" />
          <path d="M90 124 V142 C90 156, 108 164, 122 158 C136 152, 144 136, 144 122" />
          <circle cx="144" cy="112" r="12" />
          <circle cx="144" cy="112" r="5" />
        </g>
      </svg>
    );
  }

  // Engineering / Tech / Architecture: Precision Gear & Drafting Compass
  if (/هندس|مهندس|معمار|برمج|تقن|حاسوب|ميكانيك|كهرب|مدن|engin|tech|arch/i.test(text)) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 180 180"
        className="pointer-events-none select-none absolute -left-5 -bottom-5 w-36 h-36 opacity-[0.085]"
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="96" cy="96" r="34" />
          <circle cx="96" cy="96" r="14" />
          <path d="M96 48 V62 M96 130 V144 M48 96 H62 M130 96 H144 M62 62 L72 72 M120 120 L130 130 M130 62 L120 72 M72 120 L62 130" strokeWidth="4" />
          <path d="M46 146 L96 36 L146 146" strokeDasharray="3 4" strokeWidth="1.5" />
        </g>
      </svg>
    );
  }

  // Law / Justice / Sharia: Scales of Justice
  if (/قانون|محام|قاض|قضاء|شرع|عدل|حقوق|law|legal|judge/i.test(text)) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 180 180"
        className="pointer-events-none select-none absolute -left-5 -bottom-5 w-36 h-36 opacity-[0.085]"
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="90" y1="28" x2="90" y2="148" />
          <line x1="56" y1="148" x2="124" y2="148" />
          <line x1="38" y1="54" x2="142" y2="54" />
          <path d="M38 54 L24 96 H52 Z" />
          <path d="M142 54 L128 96 H156 Z" />
          <path d="M22 96 C26 112, 50 112, 54 96" />
          <path d="M126 96 C130 112, 154 112, 158 96" />
        </g>
      </svg>
    );
  }

  // Education / Academia / Science: Open Scholar Book
  if (/تعليم|أستاذ|معلم|تربي|جامع|علم|دكتور|أكاديم|بحث|edu|prof|teach/i.test(text)) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 180 180"
        className="pointer-events-none select-none absolute -left-5 -bottom-5 w-36 h-36 opacity-[0.085]"
        style={{ color: 'var(--fs-gold)' }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M90 56 C70 46, 44 46, 26 56 V134 C44 124, 70 124, 90 134 C110 124, 136 124, 154 134 V56 C136 46, 110 46, 90 56 Z" />
          <line x1="90" y1="56" x2="90" y2="134" />
          <path d="M44 76 H74 M44 94 H72 M106 76 H136 M106 94 H134" strokeWidth="1.4" />
        </g>
      </svg>
    );
  }

  // General Guild Excellence Star
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 180"
      className="pointer-events-none select-none absolute -left-5 -bottom-5 w-36 h-36 opacity-[0.08]"
      style={{ color: 'var(--fs-gold)' }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="90" cy="90" r="56" strokeDasharray="3 5" />
        <polygon points="90,26 106,74 154,90 106,106 90,154 74,106 26,90 74,74" />
        <circle cx="90" cy="90" r="18" />
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
      <div
        aria-hidden="true"
        className="pointer-events-none mx-auto max-w-4xl mb-6 flex items-center gap-3 opacity-60"
      >
        <div
          className="h-px flex-1"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--fs-gold))',
          }}
        />
        <span className="text-[10px] fs-gold-text">✦</span>
        <div
          className="h-px flex-1"
          style={{
            background: 'linear-gradient(270deg, transparent, var(--fs-gold))',
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
// 7. SINGLE EMOTIONAL INTERLUDE: EDITORIAL MEMORY COLLAGE SHOWCASE
//    (Warm Sunlit Tilted Gold-Framed Portrait + Olive Branch Poetic Plaque)
// =============================================================================
export const SingleEmotionalInterludeShowcase: React.FC<{
  config: EmotionalInterludeConfig;
  familyName: string;
  compactPreview?: boolean;
}> = ({ config, familyName, compactPreview = false }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const imageSrc = resolveEmotionalInterludeImage(config);

  useEffect(() => {
    setImgFailed(false);
  }, [imageSrc]);

  return (
    <section
      data-testid="single-emotional-interlude-showcase"
      className={`relative overflow-hidden rounded-3xl border ${
        compactPreview ? 'p-5' : 'px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14'
      }`}
      style={{
        borderColor: 'color-mix(in srgb, var(--fs-gold) 44%, transparent)',
        background:
          'radial-gradient(ellipse 75% 75% at 72% 42%, color-mix(in srgb, var(--fs-gold) 22%, var(--fs-surface)) 0%, var(--fs-surface-alt) 52%, var(--fs-surface) 100%)',
        boxShadow: '0 20px 54px -26px rgba(62, 39, 18, 0.22)',
      }}
    >
      {/* Warm Sunlit Amber Halo Glow Behind Collage */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-35"
        style={{
          background:
            'radial-gradient(circle, #F5D592 0%, rgba(212,175,106,0) 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full blur-3xl opacity-25"
        style={{
          background:
            'radial-gradient(circle, var(--fs-gold) 0%, transparent 72%)',
        }}
      />

      {/* Delicate Inner Hairline Frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 rounded-2xl border opacity-30"
        style={{ borderColor: 'var(--fs-gold)' }}
      />

      <div
        className={`relative z-10 grid items-center ${
          compactPreview
            ? 'grid-cols-1 gap-6'
            : 'grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10'
        }`}
      >
        {/* Warm Sunlit Tilted Gold-Framed Family Portrait */}
        <div
          className={`${
            compactPreview ? '' : 'lg:col-span-5'
          } flex justify-center`}
        >
          <div className="relative w-full max-w-[360px] group">
            {/* Soft Tilted Back Mat Shadow Layer */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl border translate-x-2 translate-y-2 rotate-[1.8deg] opacity-55 transition-transform duration-500 group-hover:rotate-[0.6deg]"
              style={{
                borderColor: 'var(--fs-gold)',
                backgroundColor: 'var(--fs-gold-soft)',
              }}
            />

            {/* Main Warm Tilted Gilded Portrait Frame */}
            <div
              className="relative rounded-2xl bg-[#FFFDF8] p-2.5 sm:p-3 border shadow-[0_18px_40px_-16px_rgba(44,28,14,0.34)] -rotate-[1.6deg] group-hover:rotate-0 transition-transform duration-500 ease-out"
              style={{
                borderColor:
                  'color-mix(in srgb, var(--fs-gold) 65%, transparent)',
              }}
            >
              {/* Classic Gilded Corner Mount Accents */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 rounded-tr-sm"
                style={{ borderColor: 'var(--fs-gold)' }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 rounded-bl-sm"
                style={{ borderColor: 'var(--fs-gold)' }}
              />

              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#2C1E14] relative">
                {!imgFailed && imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={config.kicker || `دفء عائلة ${familyName}`}
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{
                      filter: 'sepia(0.12) saturate(1.06) contrast(1.02)',
                    }}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center p-6 text-center text-[#F3D299]"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--fs-hero-bg) 0%, #3E2817 100%)',
                    }}
                  >
                    <span className="text-sm font-bold fs-display-font">
                      عائلة {familyName}
                    </span>
                  </div>
                )}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-amber-950/25 via-transparent to-amber-100/10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Overlapping Sunlit Poetic Quote Plaque with Olive Branch Emblem */}
        <div
          className={`${
            compactPreview
              ? 'text-center items-center'
              : 'lg:col-span-7 text-center lg:text-right items-center lg:items-start'
          } flex flex-col space-y-4`}
        >
          {/* Delicate Golden Olive Branch / Heritage Tree Crest */}
          <svg
            aria-hidden="true"
            viewBox="0 0 120 34"
            className="w-24 h-7 opacity-90"
            style={{ color: 'var(--fs-gold)' }}
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
            >
              <path d="M12 22 Q60 12 108 22" />
              <ellipse cx="36" cy="14" rx="7" ry="3" transform="rotate(-18 36 14)" />
              <ellipse cx="52" cy="12" rx="7" ry="3" transform="rotate(-8 52 12)" />
              <ellipse cx="68" cy="12" rx="7" ry="3" transform="rotate(8 68 12)" />
              <ellipse cx="84" cy="14" rx="7" ry="3" transform="rotate(18 84 14)" />
              <circle cx="60" cy="20" r="2.5" fill="currentColor" />
            </g>
          </svg>

          <div className="text-xs font-bold tracking-wide fs-accent-text">
            ✦ {config.kicker || 'صلة الأجيال وامتداد الدوحة'} ✦
          </div>

          <blockquote
            className={`${
              compactPreview
                ? 'text-lg leading-relaxed'
                : 'text-2xl sm:text-3xl lg:text-[32px] leading-relaxed sm:leading-[1.65]'
            } font-bold fs-display-font text-balance`}
          >
            <span className="fs-gold-text ml-1.5 opacity-85">«</span>
            {config.quote}
            <span className="fs-gold-text mr-1.5 opacity-85">»</span>
          </blockquote>

          <div
            className={`w-32 flex items-center gap-2 pt-1 ${
              compactPreview ? 'mx-auto' : 'mx-auto lg:mx-0'
            }`}
            aria-hidden="true"
          >
            <div
              className="h-[1.5px] flex-1"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--fs-gold))',
              }}
            />
            <span className="text-[11px] fs-gold-text">✦</span>
            <div
              className="h-[1.5px] flex-1"
              style={{
                background:
                  'linear-gradient(270deg, transparent, var(--fs-gold))',
              }}
            />
          </div>
        </div>
      </div>
    </section>
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

  const looksRawTechnical =
    !strippedExt ||
    RAW_CAMERA_FILENAME_RE.test(strippedExt) ||
    /^[A-Za-z0-9_.\-\s]+$/.test(strippedExt) ||
    /(?:^|[\s_-])(?:dsc|img|pxl|wa\d+|eng|pic|photo)\d*/i.test(strippedExt);

  if (!looksRawTechnical && HAS_ARABIC_RE.test(strippedExt)) {
    return strippedExt;
  }

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

  const desc = (item.description || '').trim();
  if (desc && HAS_ARABIC_RE.test(desc)) {
    return desc.length > 48 ? `${desc.slice(0, 46)}…` : desc;
  }

  if (/aser/i.test(strippedExt)) return 'صورة عائلية — آسر';
  if (/kareem|karim/i.test(strippedExt)) return 'من أرشيف العائلة — كريم';

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
// 10. CURATED FULL-BLEED MUSEUM GALLERY WALL (ZERO WHITE BOTTOM BOXES + LIGHTBOX)
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

  const getWallItemClass = (idx: number, total: number): string => {
    if (compactPreview) return 'col-span-1';
    if (total === 1) return 'md:col-span-12';
    if (total === 2) {
      return idx === 0 ? 'md:col-span-7' : 'md:col-span-5';
    }
    if (total === 3) {
      return idx === 0 ? 'md:col-span-7 md:row-span-2' : 'md:col-span-5';
    }
    const mod = idx % 4;
    if (mod === 0) return 'md:col-span-7';
    if (mod === 1) return 'md:col-span-5';
    if (mod === 2) return 'md:col-span-5';
    return 'md:col-span-7';
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
            !compactPreview &&
            (items.length === 1 || (items.length === 3 && idx === 0));
          const dateText = formatArabicLongDate(item.dateOrOccasion);
          const isFaceIdOpen = faceIdOpenItemId === item.id;

          return (
            <article
              key={item.id}
              onClick={() => !compactPreview && !isFaceIdOpen && setLightboxIdx(idx)}
              className={`${getWallItemClass(idx, items.length)} group relative rounded-2xl overflow-hidden border-2 cursor-pointer shadow-[0_18px_42px_-18px_rgba(24,16,10,0.42)] hover:shadow-[0_24px_52px_-18px_rgba(24,16,10,0.52)] hover:-translate-y-1 transition-all duration-300 ease-out bg-[#1C1612] ${
                isLeadFeatured
                  ? 'min-h-[340px] sm:min-h-[420px]'
                  : items.length === 2 && idx === 0 && !compactPreview
                    ? 'min-h-[300px] sm:min-h-[360px]'
                    : 'min-h-[270px] sm:min-h-[310px]'
              }`}
              style={{
                borderColor:
                  'color-mix(in srgb, var(--fs-gold) 52%, transparent)',
              }}
            >
              {/* Delicate Inner Hairline Museum Frame */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-2.5 rounded-xl border border-[#F3D299]/25 z-20"
              />

              {/* Full-Bleed Artwork Photography */}
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={cleanTitle}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#F3D299]/80 bg-gradient-to-br from-[#2B211A] to-[#17120E]">
                  <FileText className="w-12 h-12" />
                  <span className="text-xs font-bold">وثيقة أرشيفية محفوظة</span>
                </div>
              )}

              {/* Warm Measured Museum Bottom Gradient Scrim (WCAG AA+ >= 4.5:1) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#120D09]/92 via-[#120D09]/42 to-black/10 transition-opacity duration-300"
              />

              {/* Top Controls Row: Watermark & Zoom Lens */}
              <div className="absolute top-4 inset-x-4 z-20 flex items-center justify-between gap-2">
                {item.watermarkText ? (
                  <span className="px-2.5 py-1 rounded-lg bg-black/45 backdrop-blur-sm border border-white/15 text-[10px] text-[#FAF2E3] font-semibold pointer-events-none">
                    {item.watermarkText}
                  </span>
                ) : (
                  <span />
                )}

                {!compactPreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIdx(idx);
                    }}
                    title="تكبير في العارض المتحفي"
                    aria-label="تكبير في العارض المتحفي"
                    className="w-9 h-9 rounded-full bg-black/55 hover:bg-black/80 text-[#F6E2B3] border border-[#E5C481]/50 flex items-center justify-center cursor-pointer shadow-md transition-transform duration-200 hover:scale-105"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Frosted Warm Glass Bottom Caption Overlay (NO THICK WHITE CARD BELOW) */}
              <div
                onClick={(e) => isFaceIdOpen && e.stopPropagation()}
                className="absolute inset-x-0 bottom-0 z-20 p-4 sm:p-5 space-y-2.5 text-[#FFF9EE]"
              >
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-[#F3D299] tracking-wide">
                    {item.mediaType === 'document'
                      ? 'وثيقة أرشيفية'
                      : 'من ألبوم العائلة'}
                    {dateText ? ` · ${dateText}` : ''}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold fs-display-font leading-snug drop-shadow-xs line-clamp-2">
                    {cleanTitle}
                  </h3>
                </div>

                {enablePhotoFacePrompt && !compactPreview && (
                  <div className="pt-2 border-t border-white/15 space-y-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFaceIdOpenItemId(isFaceIdOpen ? null : item.id);
                      }}
                      className="text-[11.5px] font-bold text-[#F6E2B3] hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        هل تعرف شخصاً في هذه الصورة؟ (
                        {item.faceIdNotes?.length || 0})
                      </span>
                    </button>

                    {isFaceIdOpen && (
                      <div className="rounded-xl bg-[#1A130E]/92 backdrop-blur-md border border-[#E5C481]/40 p-3 space-y-2">
                        <input
                          type="text"
                          value={faceIdSenderName}
                          onChange={(e) => setFaceIdSenderName(e.target.value)}
                          placeholder="اسمك الكريم"
                          className="w-full px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs text-white placeholder:text-white/60 focus:outline-none focus:border-[#E5C481]"
                        />
                        <input
                          type="text"
                          value={faceIdNote}
                          onChange={(e) => setFaceIdNote(e.target.value)}
                          placeholder="مثال: الواقف يميناً هو الجد..."
                          className="w-full px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs text-white placeholder:text-white/60 focus:outline-none focus:border-[#E5C481]"
                        />
                        <button
                          type="button"
                          onClick={() => onSubmitFaceId(item.id)}
                          className="w-full py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#c59f2c] text-[#1A130E] text-xs font-bold cursor-pointer transition-colors"
                        >
                          إرسال التعريف لأمين السجل
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
              borderColor:
                'color-mix(in srgb, var(--fs-gold) 45%, transparent)',
            }}
          >
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

// =============================================================================
// 11. FULL-SCREEN STORYBOOK READING MODAL (WARM EDITORIAL READING MODE)
// =============================================================================
export const StorybookReadingModal: React.FC<{
  story: {
    title: string;
    eraOrYearLabel: string;
    body: string;
    imageUrl?: string;
    chapterNumber: number;
  } | null;
  familyName: string;
  formatArabicLongDate: (raw?: string) => string;
  onClose: () => void;
}> = ({ story, familyName, formatArabicLongDate, onClose }) => {
  useEffect(() => {
    if (!story || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [story, onClose]);

  if (!story) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={story.title}
      className="fixed inset-0 z-[80] bg-[#16100B]/88 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] rounded-3xl fs-surface border shadow-2xl overflow-hidden flex flex-col"
        style={{
          borderColor: 'color-mix(in srgb, var(--fs-gold) 55%, transparent)',
        }}
      >
        {/* Running Book Header */}
        <div
          className="px-6 py-4 border-b fs-border flex items-center justify-between gap-3"
          style={{
            background:
              'linear-gradient(135deg, var(--fs-gold-soft) 0%, var(--fs-surface) 100%)',
          }}
        >
          <div className="flex items-center gap-2 text-xs font-bold fs-accent-text">
            <BookOpen className="w-4 h-4 fs-gold-text" />
            <span>
              سجل مرويات عائلة {familyName} · الفصل{' '}
              {String(story.chapterNumber).padStart(2, '0')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة القراءة"
            className="w-8 h-8 rounded-full fs-surface-alt border fs-border flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comfortable Book Reading Body */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-6 fs-epistle-ruled">
          <div className="text-center space-y-2">
            {story.eraOrYearLabel && (
              <div className="text-xs font-bold fs-accent-text tabular-nums">
                ✦ {formatArabicLongDate(story.eraOrYearLabel)} ✦
              </div>
            )}
            <h2 className="text-2xl sm:text-3xl font-bold fs-display-font leading-snug text-balance">
              {story.title}
            </h2>
          </div>

          {story.imageUrl && (
            <div className="max-w-xl mx-auto rounded-2xl bg-[#FFFDF8] p-2.5 border shadow-md" style={{ borderColor: 'color-mix(in srgb, var(--fs-gold) 45%, transparent)' }}>
              <img
                src={story.imageUrl}
                alt={story.title}
                referrerPolicy="no-referrer"
                className="w-full max-h-72 object-cover rounded-xl"
              />
            </div>
          )}

          <div className="max-w-2xl mx-auto text-sm sm:text-base leading-[2.05] whitespace-pre-line">
            <span className="fs-gold-text text-2xl font-bold ml-1.5">✦</span>
            {story.body}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 12. ACOUSTIC VINYL & 42-BAR EQUALIZER CONSOLE (ORAL HERITAGE STUDIO)
// =============================================================================
const EQUALIZER_42_BARS = [
  24, 42, 30, 68, 52, 86, 44, 74, 92, 58, 82, 48, 96, 62, 78, 36, 64, 88, 54,
  72, 94, 46, 80, 66, 90, 50, 76, 40, 84, 60, 92, 56, 70, 38, 64, 82, 48, 74,
  58, 44, 34, 26,
];

function formatAudioSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const AcousticVinylConsole: React.FC<{
  clip: {
    id: string;
    title: string;
    speakerName: string;
    recordedYearLabel?: string;
    audioDataOrUrl?: string;
    transcriptExcerpt?: string;
  };
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  inBentoPair?: boolean;
  compactPreview?: boolean;
  onTogglePlay: (clipId: string, src?: string) => void;
}> = ({
  clip,
  isPlaying,
  currentTimeSec,
  durationSec,
  inBentoPair = false,
  compactPreview = false,
  onTogglePlay,
}) => {
  const hasAudio = Boolean(clip.audioDataOrUrl);
  const progressRatio =
    isPlaying && durationSec > 0 ? Math.min(1, currentTimeSec / durationSec) : 0;

  return (
    <article
      className="relative overflow-hidden rounded-3xl border shadow-[0_18px_46px_-22px_rgba(24,16,10,0.42)] text-[#FFF8EC]"
      style={{
        borderColor: isPlaying
          ? 'var(--fs-gold)'
          : 'color-mix(in srgb, var(--fs-gold) 46%, transparent)',
        background:
          'linear-gradient(135deg, #241811 0%, #372315 52%, #1D130D 100%)',
      }}
    >
      {/* Large Acoustic Oud & Soundwave Watermark */}
      <HeritageAmbientWatermark
        variant="acoustic_oud"
        position="left"
        opacityClass="opacity-[0.11]"
      />

      {/* Top Gilded Hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 h-[1.5px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--fs-gold), transparent)',
        }}
      />

      <div
        className={`relative z-10 p-5 sm:p-7 grid gap-6 items-center ${
          !inBentoPair && !compactPreview && clip.transcriptExcerpt
            ? 'grid-cols-1 lg:grid-cols-12'
            : 'grid-cols-1'
        }`}
      >
        {/* Right: Vinyl Disc + Track Info + 42-Bar Golden Equalizer */}
        <div
          className={`${
            !inBentoPair && !compactPreview && clip.transcriptExcerpt
              ? 'lg:col-span-7'
              : ''
          } space-y-5`}
        >
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Rotating Gilded Vinyl / Audio Reel Medallion */}
            <button
              type="button"
              disabled={!hasAudio}
              onClick={() => onTogglePlay(clip.id, clip.audioDataOrUrl)}
              aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التسجيل الصوتي'}
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full shrink-0 flex items-center justify-center cursor-pointer disabled:opacity-55 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F3D299]"
            >
              {/* Vinyl Grooves Outer Disc */}
              <span
                aria-hidden="true"
                className={`absolute inset-0 rounded-full border-2 shadow-xl ${
                  isPlaying ? 'fs-vinyl-spin' : ''
                }`}
                style={{
                  borderColor: 'var(--fs-gold)',
                  background:
                    'repeating-radial-gradient(circle at center, #1C140F 0px, #1C140F 3px, #2D2017 4px, #140E0A 5px)',
                }}
              >
                <span
                  className="absolute inset-2.5 rounded-full border border-dashed opacity-45"
                  style={{ borderColor: '#F3D299' }}
                />
              </span>

              {/* Center Gilded Play Label */}
              <span
                className="relative z-10 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-105"
                style={{
                  background:
                    'linear-gradient(135deg, #F4D99B 0%, var(--fs-gold) 65%, #9C7125 100%)',
                  color: '#1C130C',
                }}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current mr-0.5" />
                )}
              </span>
            </button>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#F3D299]">
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isPlaying
                    ? 'جاري الاستماع الآن'
                    : hasAudio
                      ? 'تسجيل صوتي تراثي موثّق'
                      : 'مروية شعرية موثّقة'}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold fs-display-font text-[#FFF9EE] leading-snug">
                {clip.title}
              </h3>
              <div className="text-xs text-[#F7E8CF]/75">
                بصوت / رواية: {clip.speakerName}
                {clip.recordedYearLabel ? ` · ${clip.recordedYearLabel}` : ''}
              </div>
            </div>
          </div>

          {/* Rich 42-Bar Golden Audio Equalizer Console */}
          <div
            className="rounded-2xl bg-black/35 border px-4 py-3.5 space-y-2.5"
            style={{
              borderColor: 'color-mix(in srgb, var(--fs-gold) 32%, transparent)',
            }}
          >
            <div
              className="flex items-end gap-[3px] h-11 w-full"
              aria-hidden="true"
            >
              {EQUALIZER_42_BARS.map((heightPct, idx) => {
                const barProgress = idx / EQUALIZER_42_BARS.length;
                const isPassed = isPlaying && barProgress <= progressRatio;
                return (
                  <span
                    key={idx}
                    className={`flex-1 rounded-full transition-opacity ${
                      isPlaying ? 'fs-wave-bar-playing' : ''
                    }`}
                    style={{
                      height: `${heightPct}%`,
                      background: isPassed
                        ? 'linear-gradient(180deg, #FFF1C9 0%, #E6BC6A 100%)'
                        : idx % 4 === 0
                          ? 'linear-gradient(180deg, #F3D299 0%, #B88635 100%)'
                          : 'linear-gradient(180deg, #D9B063 0%, #7A5622 100%)',
                      opacity: isPlaying ? (isPassed ? 1 : 0.85) : 0.62,
                      animationDelay: `${(idx % 9) * 0.11}s`,
                    }}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#F3D299]/85">
              <span>{isPlaying ? formatAudioSeconds(currentTimeSec) : '00:00'}</span>
              <span className="font-sans text-[10.5px] text-[#FAF0DF]/65">
                {hasAudio
                  ? 'انقر على الأسطوانة للتشغيل أو الإيقاف'
                  : 'نص شعري محفوظ دون ملف صوتي مرفق'}
              </span>
              <span>
                {isPlaying && durationSec > 0
                  ? formatAudioSeconds(durationSec)
                  : hasAudio
                    ? 'أرشيف حي'
                    : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Left: Gold-Framed Poetic Diwan Plaque */}
        {clip.transcriptExcerpt && (
          <blockquote
            className={`${
              !inBentoPair && !compactPreview ? 'lg:col-span-5' : ''
            } relative rounded-2xl bg-white/[0.06] border p-5 sm:p-6 space-y-2.5`}
            style={{
              borderColor: 'color-mix(in srgb, var(--fs-gold) 44%, transparent)',
            }}
          >
            <div className="text-[11px] font-bold text-[#F3D299]">
              ✦ من أبيات ونص المروية
            </div>
            <p className="text-base sm:text-lg fs-display-font leading-loose text-[#FFF9EE] whitespace-pre-line">
              <span className="text-[#F3D299] font-bold ml-1.5">«</span>
              {clip.transcriptExcerpt}
              <span className="text-[#F3D299] font-bold mr-1.5">»</span>
            </p>
          </blockquote>
        )}
      </div>
    </article>
  );
};
