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
