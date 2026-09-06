import React, { useState } from 'react';

export interface ItemIconProps {
  itemId?: number | string | null;
  icon?: string | null;
  name?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_ICON = '/ops/item-icons/i80914.webp';

export const ItemIcon: React.FC<ItemIconProps> = ({
  itemId,
  icon,
  name,
  size = 32,
  className = '',
  style = {},
}) => {
  const [useFallback, setUseFallback] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Clean and parse itemId
  const numId = typeof itemId === 'string' ? Number(itemId) : itemId;
  const validId = typeof numId === 'number' && Number.isSafeInteger(numId) && numId > 0;

  // Determine icon source
  let primarySrc: string | undefined;
  if (icon && typeof icon === 'string' && icon.trim() !== '') {
    const cleanIcon = icon.trim().toLowerCase().replace(/\.webp$/, '');
    primarySrc = `/ops/item-icons/${cleanIcon}.webp`;
  } else if (validId) {
    primarySrc = `/ops/api/item-icon/${numId}`;
  }

  const src = useFallback ? DEFAULT_ICON : (primarySrc || DEFAULT_ICON);

  const boxStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    ...style,
  };

  const titleText = name
    ? `${name}${validId ? ` (#${numId})` : ''}`
    : validId
    ? `Item #${numId}`
    : 'Item';

  if (hasError) {
    return (
      <div
        className={`ak-item-icon ak-item-icon-empty ${className}`}
        style={boxStyle}
        title={titleText}
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`ak-item-icon ${className}`}
      style={boxStyle}
      title={titleText}
    >
      <img
        src={src}
        alt={titleText}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => {
          if (!useFallback && src !== DEFAULT_ICON) {
            setUseFallback(true);
          } else {
            setHasError(true);
          }
        }}
      />
    </div>
  );
};
