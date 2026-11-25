import React, { useEffect, useRef, useState } from 'react';
import { Home } from 'lucide-react';

interface JuthoriLogoProps {
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showText?: boolean;
  confirmHomeNavigation?: boolean;
  confirmAlign?: 'start' | 'center';
}

export const JuthoriLogo: React.FC<JuthoriLogoProps> = ({
  size = 'md',
  onClick,
  showText = false,
  confirmHomeNavigation = false,
  confirmAlign = 'start',
}) => {
  const [showConfirmPopover, setShowConfirmPopover] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showConfirmPopover) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowConfirmPopover(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowConfirmPopover(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showConfirmPopover]);

  const imgHeight =
    size === 'sm' ? 'h-9' : size === 'lg' ? 'h-14' : 'h-11';

  const content = (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <img
        src="/assets/aistudio/Juthorilogo_b9f8e7f6.png"
        alt="جذوري — Juthori"
        className={`${imgHeight} w-auto object-contain transition-transform duration-150 group-hover:scale-[1.03]`}
        draggable={false}
      />
      {showText && (
        <span className="sr-only">جذوري — Juthori</span>
      )}
    </span>
  );

  if (onClick && confirmHomeNavigation) {
    const popoverPositionClass =
      confirmAlign === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'right-0';

    return (
      <div
        ref={containerRef}
        className="relative inline-flex items-center"
      >
        <button
          type="button"
          onClick={() => setShowConfirmPopover((prev) => !prev)}
          aria-label="شعار منصة جذوري"
          aria-expanded={showConfirmPopover}
          aria-haspopup="true"
          className="group inline-flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D97757] rounded-xl cursor-pointer"
        >
          {content}
        </button>

        {showConfirmPopover && (
          <div
            role="menu"
            className={`absolute top-full mt-2 ${popoverPositionClass} z-[70]`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setShowConfirmPopover(false);
                onClick();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] hover:border-[#D97757] text-[#1F1F1C] hover:text-[#D97757] text-xs font-display font-bold shadow-[0_10px_28px_-10px_rgba(31,31,28,0.22)] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Home className="w-3.5 h-3.5 text-[#D97757] shrink-0" aria-hidden="true" />
              <span>الذهاب إلى الصفحة الرئيسية لمنصة جذوري</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="شعار منصة جذوري"
        className="group inline-flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D97757] rounded-xl cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return content;
};
