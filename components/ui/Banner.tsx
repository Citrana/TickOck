import {ReactNode} from 'react';

type BannerProps = {
  children: ReactNode;
};

// Informational strip used to flag non-default states (e.g. a platform
// admin editing another user's resource) above the main page content.
export default function Banner({children}: BannerProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      {children}
    </div>
  );
}
