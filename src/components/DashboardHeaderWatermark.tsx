import React from 'react';

/**
 * Subtle Architectural Heritage Watermark for the Single-Row Luxury Client Header.
 * Calibrated for a sleek 78px single-row desktop silhouette (and graceful 2-row tablet/mobile wrap):
 * keeps the center navigation zone ultra-clean and legible while sweeping delicate Islamic
 * geometric star-lattice motifs and symmetric abstract lineage vines across the warm ivory canvas.
 */
export const DashboardHeaderWatermark: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-0 overflow-hidden z-0"
    >
      {/* Subtle warm muted-sand luminance behind the unified bar */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 62% 110% at 50% 50%, rgba(216, 199, 178, 0.14) 0%, rgba(216, 199, 178, 0.04) 58%, transparent 100%)',
        }}
      />

      {/* Horizontal Architectural Arabesque & Sweeping Lineage Vine Watermark */}
      <svg
        viewBox="0 0 1380 88"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full opacity-[0.05]"
      >
        <defs>
          {/* Softer center luminance mask so the 7 center nav buttons stay crisp */}
          <linearGradient
            id="juthori-wm-fade-h"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#1F1F1C" stopOpacity="0.16" />
            <stop offset="18%" stopColor="#1F1F1C" stopOpacity="0.82" />
            <stop offset="50%" stopColor="#1F1F1C" stopOpacity="0.52" />
            <stop offset="82%" stopColor="#1F1F1C" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#1F1F1C" stopOpacity="0.16" />
          </linearGradient>

          <pattern
            id="juthori-arabesque-lattice"
            width="56"
            height="56"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M28 4 L34 22 L52 28 L34 34 L28 52 L22 34 L4 28 L22 22 Z"
              stroke="#1F1F1C"
              strokeWidth="0.65"
            />
            <rect
              x="14"
              y="14"
              width="28"
              height="28"
              transform="rotate(45 28 28)"
              stroke="#1F1F1C"
              strokeWidth="0.5"
            />
            <circle cx="28" cy="28" r="4.5" stroke="#1F1F1C" strokeWidth="0.55" />
          </pattern>

          <mask id="juthori-lattice-mask">
            <rect width="1380" height="88" fill="url(#juthori-wm-fade-h)" />
          </mask>
        </defs>

        {/* Whisper-light Islamic geometric lattice spanning the header */}
        <rect
          width="1380"
          height="88"
          fill="url(#juthori-arabesque-lattice)"
          opacity="0.38"
          mask="url(#juthori-lattice-mask)"
        />

        {/* Delicate Centered Rub-el-Hizb Medallion calibrated to 78px single-row height */}
        <g
          transform="translate(690 44)"
          stroke="#1F1F1C"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.72"
        >
          <circle r="38" strokeWidth="0.75" strokeDasharray="3 5" />
          <circle r="31" strokeWidth="0.95" />
          <circle r="24" strokeWidth="0.6" />
          <circle r="10" strokeWidth="0.8" />
          <circle r="3.2" fill="#1F1F1C" fillOpacity="0.4" />

          <rect x="-18" y="-18" width="36" height="36" strokeWidth="0.9" />
          <rect
            x="-18"
            y="-18"
            width="36"
            height="36"
            transform="rotate(45)"
            strokeWidth="0.9"
          />

          <path
            d="M0 -24 C5 -13 13 -5 24 0 C13 5 5 13 0 24 C-5 13 -13 5 -24 0 C-13 -5 -5 -13 0 -24 Z"
            strokeWidth="0.75"
          />
        </g>

        {/* Symmetric Horizontal Lineage Vines sweeping smoothly toward both wings */}
        <g
          stroke="url(#juthori-wm-fade-h)"
          strokeWidth="1.05"
          strokeLinecap="round"
          fill="none"
        >
          {/* Right Flowing Lineage Vine */}
          <path d="M736 44 C796 44 832 22 904 22 C968 22 1006 42 1078 42 C1142 42 1184 26 1256 26" />
          <path d="M744 48 C808 50 848 68 922 66 C986 64 1026 50 1094 52 C1154 54 1192 66 1260 64" />

          {/* Abstract Heritage Leaves & Lineage Nodes (Right) */}
          <path
            d="M836 31 C846 19 862 17 870 25 C858 31 846 34 836 31 Z"
            fill="#1F1F1C"
            fillOpacity="0.2"
          />
          <path
            d="M936 25 C948 14 964 15 970 24 C958 29 946 29 936 25 Z"
            fill="#1F1F1C"
            fillOpacity="0.16"
          />
          <path
            d="M882 59 C894 69 910 70 918 62 C904 58 892 57 882 59 Z"
            fill="#1F1F1C"
            fillOpacity="0.16"
          />
          <path
            d="M1022 39 C1034 29 1050 30 1056 38 C1044 42 1032 43 1022 39 Z"
            fill="#1F1F1C"
            fillOpacity="0.15"
          />
          <circle cx="904" cy="22" r="2.8" fill="#1F1F1C" fillOpacity="0.32" />
          <circle cx="1078" cy="42" r="2.6" fill="#1F1F1C" fillOpacity="0.28" />
          <circle cx="922" cy="66" r="2.4" fill="#1F1F1C" fillOpacity="0.26" />

          {/* Left Flowing Lineage Vine (Mirror Symmetry) */}
          <path d="M644 44 C584 44 548 22 476 22 C412 22 374 42 302 42 C238 42 196 26 124 26" />
          <path d="M636 48 C572 50 532 68 458 66 C394 64 354 50 286 52 C226 54 188 66 120 64" />

          {/* Abstract Heritage Leaves & Lineage Nodes (Left) */}
          <path
            d="M544 31 C534 19 518 17 510 25 C522 31 534 34 544 31 Z"
            fill="#1F1F1C"
            fillOpacity="0.2"
          />
          <path
            d="M444 25 C432 14 416 15 410 24 C422 29 434 29 444 25 Z"
            fill="#1F1F1C"
            fillOpacity="0.16"
          />
          <path
            d="M498 59 C486 69 470 70 462 62 C476 58 488 57 498 59 Z"
            fill="#1F1F1C"
            fillOpacity="0.16"
          />
          <path
            d="M358 39 C346 29 330 30 324 38 C336 42 348 43 358 39 Z"
            fill="#1F1F1C"
            fillOpacity="0.15"
          />
          <circle cx="476" cy="22" r="2.8" fill="#1F1F1C" fillOpacity="0.32" />
          <circle cx="302" cy="42" r="2.6" fill="#1F1F1C" fillOpacity="0.28" />
          <circle cx="458" cy="66" r="2.4" fill="#1F1F1C" fillOpacity="0.26" />
        </g>

        {/* Fine architectural top whisper hairline */}
        <line
          x1="140"
          y1="8"
          x2="1240"
          y2="8"
          stroke="url(#juthori-wm-fade-h)"
          strokeWidth="0.55"
          strokeDasharray="6 9"
        />
      </svg>
    </div>
  );
};
