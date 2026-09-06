import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;
const Base = ({ children, ...props }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const SigilIcon = (props: Props) => <Base {...props}><path d="M12 2 4.5 6.3v8.6L12 22l7.5-7.1V6.3L12 2Z"/><path d="m8.4 14.8 3.6-8 3.6 8M9.7 12h4.6"/></Base>;
export const PulseIcon = (props: Props) => <Base {...props}><path d="M3 12h4l2.2-6 4.1 12 2.2-6H21"/></Base>;
export const ServerIcon = (props: Props) => <Base {...props}><rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 7h.01M7 17h.01M11 7h7M11 17h7"/></Base>;
export const ScrollIcon = (props: Props) => <Base {...props}><path d="M6 3h12v15a3 3 0 0 1-3 3H6a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3Z"/><path d="M6 3a3 3 0 0 0-3 3v1h6M12 9h3M12 13h3"/></Base>;
export const UsersIcon = (props: Props) => <Base {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Base>;
export const RefreshIcon = (props: Props) => <Base {...props}><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></Base>;
export const LogoutIcon = (props: Props) => <Base {...props}><path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></Base>;
export const SearchIcon = (props: Props) => <Base {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Base>;
export const ChevronIcon = (props: Props) => <Base {...props}><path d="m9 18 6-6-6-6"/></Base>;
export const LockIcon = (props: Props) => <Base {...props}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></Base>;
export const MenuIcon = (props: Props) => <Base {...props}><path d="M4 6h16M4 12h16M4 18h16"/></Base>;
export const CloseIcon = (props: Props) => <Base {...props}><path d="m6 6 12 12M18 6 6 18"/></Base>;
export const ShopIcon = (props: Props) => (
  <Base {...props}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </Base>
);
export const PlusIcon = (props: Props) => <Base {...props}><path d="M12 5v14M5 12h14"/></Base>;
export const TrashIcon = (props: Props) => <Base {...props}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></Base>;
export const GiftIcon = (props: Props) => (
  <Base {...props}>
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </Base>
);
export const CartIcon = (props: Props) => (
  <Base {...props}>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </Base>
);

export const TicketIcon = (props: Props) => (
  <Base {...props}>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2M13 17v2M13 11v2" />
  </Base>
);

export const CopyIcon = (props: Props) => (
  <Base {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Base>
);

export const SparklesIcon = (props: Props) => (
  <Base {...props}>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    <path d="M5 3v4M3 5h4M19 17v4M17 19h4" />
  </Base>
);

export const ZapIcon = (props: Props) => (
  <Base {...props}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </Base>
);

export const TreasureIcon = (props: Props) => (
  <Base {...props}>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </Base>
);

export const CrownIcon = (props: Props) => (
  <Base {...props}>
    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </Base>
);

export const PackageIcon = (props: Props) => (
  <Base {...props}>
    <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <line x1="12" y1="22" x2="12" y2="12" />
  </Base>
);

export const TableIcon = (props: Props) => (
  <Base {...props}>
    <path d="M12 3v18M3 9h18M3 15h18" />
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </Base>
);

export const GridIcon = (props: Props) => (
  <Base {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </Base>
);

export const CheckIcon = (props: Props) => (
  <Base {...props}>
    <polyline points="20 6 9 17 4 12" />
  </Base>
);

export const DatabaseIcon = (props: Props) => (
  <Base {...props}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </Base>
);
