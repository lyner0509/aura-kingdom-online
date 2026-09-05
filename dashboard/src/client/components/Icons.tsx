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
