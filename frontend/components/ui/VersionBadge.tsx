'use client';

import { Badge } from './Badge';
import packageJson from '../../package.json';

export function VersionBadge() {
  return (
    <div className="fixed top-2 right-2 z-[9999]">
      <Badge variant="info" className="text-xs font-mono">
        v{packageJson.version}
      </Badge>
    </div>
  );
}
