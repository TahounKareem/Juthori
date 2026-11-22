import React from 'react';

/**
 * Subtle Architectural Heritage Watermark for the Client Dashboard Header.
 * Combines a delicate 8-point Islamic Arabesque medallion at center with
 * symmetric abstract genealogical lineage vines fading gracefully into the ivory canvas.
 */
export const DashboardHeaderWatermark: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-0 overflow-hidden z-0"
    >
      {/* Subtle warm radial luminance in the center breathing zone */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 58% 95% at 50% 42%, rgba(212, 175, 55, 0.065) 0%, rgba(212, 175, 55, 0.015) 55%, transparent 100%)',
        }}
      />

      {/* Custom SVG Arabesque & Abstract Lineage Branch Watermark */}
      <svg
        viewBox="0 0 1280 156"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full opacity-[0.048]"
      >
        <defs>
          <linearGradient
            id="juthori-wm-fade-h"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#6E4B1F" stopOpacity="0.18" />
            <stop offset="22%" stopColor="#6E4B1F" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#6E4B1F" stopOpacity="1" />
            <stop offset="78%" stopColor="#6E4B1F" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#6E4B1F" stopOpacity="0.18" />
          </linearGradient>

          <pattern
            id="juthori-arabesque-lattice"
            width="64"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            {/* Delicate geometric eight-point star tile */}
            <path
              d="M32 4 L39 25 L60 32 L39 39 L32 60 L25 39 L4 32 L25 25 Z"
              stroke="#7A5524"
              strokeWidth="0.7"
            />
            <rect
              x="16"
              y="16"
              width="32"
              height="32"
              transform="rotate(45 32 32)"
              stroke="#7A5524"
              strokeWidth="0.55"
            />
            <circle cx="32" cy="32" r="5.5" stroke="#7A5524" strokeWidth="0.6" />
          </pattern>

          <mask id="juthori-lattice-mask">
            <rect width="1280" height="156" fill="url(#juthori-wm-fade-h)" />
          </mask>
        </defs>

        {/* Whisper-light Islamic geometric lattice across the header canvas */}
        <rect
          width="1280"
          height="156"
          fill="url(#juthori-arabesque-lattice)"
          opacity="0.42"
          mask="url(#juthori-lattice-mask)"
        />

        {/* Center Architectural Rub-el-Hizb Medallion & Concentric Compass Rings */}
        <g
          transform="translate(640 72)"
          stroke="#6E4B1F"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle r="66" strokeWidth="0.9" strokeDasharray="3 5" />
          <circle r="54" strokeWidth="1.15" />
          <circle r="44" strokeWidth="0.7" />
          <circle r="18" strokeWidth="0.95" />
          <circle r="6" fill="#6E4B1F" fillOpacity="0.45" />

          {/* Rotated dual-square 8-point heritage star */}
          <rect x="-32" y="-32" width="64" height="64" strokeWidth="1.1" />
          <rect
            x="-32"
            y="-32"
            width="64"
            height="64"
            transform="rotate(45)"
            strokeWidth="1.1"
          />

          {/* Fine interior geometric petals */}
          <path
            d="M0 -44 C9 -24 24 -9 44 0 C24 9 9 24 0 44 C-9 24 -24 9 -44 0 C-24 -9 -9 -24 0 -44 Z"
            strokeWidth="0.9"
          />
          <path
            d="M-31 -31 C-12 -20 12 -20 31 -31 C20 -12 20 12 31 31 C12 20 -12 20 -31 31 C-20 12 -20 -12 -31 -31 Z"
            strokeWidth="0.7"
          />
        </g>

        {/* Symmetric Abstract Genealogical Branching Vines (Right & Left Wings) */}
        <g
          stroke="url(#juthori-wm-fade-h)"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        >
          {/* Right Flowing Lineage Vine */}
          <path d="M708 72 C758 72 786 38 848 38 C904 38 938 66 998 66 C1054 66 1086 44 1148 44" />
          <path d="M718 78 C772 82 802 112 868 110 C924 108 958 84 1018 86 C1066 88 1098 106 1152 104" />

          {/* Abstract Heritage Leaves & Lineage Nodes (Right) */}
          <path
            d="M788 53 C798 37 816 34 824 44 C812 52 798 56 788 53 Z"
            fill="#6E4B1F"
            fillOpacity="0.22"
          />
          <path
            d="M876 42 C889 27 908 28 914 40 C900 46 886 47 876 42 Z"
            fill="#6E4B1F"
            fillOpacity="0.18"
          />
          <path
            d="M824 98 C836 113 854 114 862 103 C848 97 835 95 824 98 Z"
            fill="#6E4B1F"
            fillOpacity="0.18"
          />
          <path
            d="M948 61 C961 48 979 49 985 60 C972 65 959 66 948 61 Z"
            fill="#6E4B1F"
            fillOpacity="0.16"
          />
          <circle cx="848" cy="38" r="3.5" fill="#6E4B1F" fillOpacity="0.35" />
          <circle cx="998" cy="66" r="3.2" fill="#6E4B1F" fillOpacity="0.3" />
          <circle cx="868" cy="110" r="3" fill="#6E4B1F" fillOpacity="0.28" />

          {/* Left Flowing Lineage Vine (Mirror Symmetry) */}
          <path d="M572 72 C522 72 494 38 432 38 C376 38 342 66 282 66 C226 66 194 44 132 44" />
          <path d="M562 78 C508 82 478 112 412 110 C356 108 322 84 262 86 C214 88 182 106 128 104" />

          {/* Abstract Heritage Leaves & Lineage Nodes (Left) */}
          <path
            d="M492 53 C482 37 464 34 456 44 C468 52 482 56 492 53 Z"
            fill="#6E4B1F"
            fillOpacity="0.22"
          />
          <path
            d="M404 42 C391 27 372 28 366 40 C380 46 394 47 404 42 Z"
            fill="#6E4B1F"
            fillOpacity="0.18"
          />
          <path
            d="M456 98 C444 113 426 114 418 103 C432 97 445 95 456 98 Z"
            fill="#6E4B1F"
            fillOpacity="0.18"
          />
          <path
            d="M332 61 C319 48 301 49 295 60 C308 65 321 66 332 61 Z"
            fill="#6E4B1F"
            fillOpacity="0.16"
          />
          <circle cx="432" cy="38" r="3.5" fill="#6E4B1F" fillOpacity="0.35" />
          <circle cx="282" cy="66" r="3.2" fill="#6E4B1F" fillOpacity="0.3" />
          <circle cx="412" cy="110" r="3" fill="#6E4B1F" fillOpacity="0.28" />
        </g>

        {/* Fine gilded top architectural hairline ornament */}
        <line
          x1="180"
          y1="14"
          x2="1100"
          y2="14"
          stroke="url(#juthori-wm-fade-h)"
          strokeWidth="0.6"
          strokeDasharray="6 8"
        />
      </svg>
    </div>
  );
};
