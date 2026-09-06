import React, { useState } from 'react';

export interface ItemIconProps {
  itemId?: number | string | null;
  icon?: string | null;
  name?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const ItemIcon: React.FC<ItemIconProps> = ({
  itemId,
  icon,
  name,
  size = 32,
  className = '',
  style = {},
}) => {
  const [hasError, setHasError] = useState(false);

  // Clean and parse itemId
  const numId = typeof itemId === 'string' ? Number(itemId) : itemId;
  const validId = typeof numId === 'number' && Number.isSafeInteger(numId) && numId > 0;

  // Determine icon source
  let src: string | undefined;
  if (icon && typeof icon === 'string' && icon.trim() !== '') {
    const cleanIcon = icon.trim().toLowerCase().replace(/\.webp$/, '');
    src = `/ops/item-icons/${cleanIcon}.webp`;
  } else if (validId) {
    src = `/ops/api/item-icon/${numId}`;
  }

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

  if (!src || hasError) {
    return (
      <div
        className={`ak-item-icon ak-item-icon-empty ${className}`}
        style={boxStyle}
        title={titleText}
      >
        <span className="ak-item-icon-fallback-char">
          {validId ? '?' : '—'}
        </span>
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
        onError={() => setHasError(true)}
      />
    </div>
  );
};
