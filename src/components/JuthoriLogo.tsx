import React from 'react';

interface JuthoriLogoProps {
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showText?: boolean;
}

export const JuthoriLogo: React.FC<JuthoriLogoProps> = ({
  size = 'md',
  onClick,
  showText = false,
}) => {
  const dimensions =
    size === 'sm'
      ? 'w-11 h-11 rounded-xl'
      : size === 'lg'
        ? 'w-16 h-16 rounded-2xl'
        : 'w-13 h-13 rounded-xl';

  const arSize =
    size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';
  const enSize =
    size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-[11px]' : 'text-[10px]';

  const content = (
    <span className="inline-flex items-center gap-3 whitespace-nowrap shrink-0 select-none">
      {/* Official Juthori Logo Mark: Coral rounded square with Arabic calligraphy and Latin tracking */}
      <span
        className={`${dimensions} bg-[#D8755B] text-white flex flex-col items-center justify-center shadow-sm transition-transform duration-150 group-hover:scale-[1.02]`}
      >
        <span className={`${arSize} font-display font-bold leading-none tracking-tight`}>
          جذوري
        </span>
        <span
          dir="ltr"
          className={`${enSize} font-sans font-medium lowercase tracking-[0.18em] leading-none mt-1 opacity-95`}
        >
          juthori
        </span>
      </span>

      {showText && (
        <span className="font-display font-bold text-xl text-[#252321] tracking-tight">
          جذوري
        </span>
      )}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="شعار منصة جذوري"
        className="group inline-flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8755B] rounded-xl cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return content;
};
