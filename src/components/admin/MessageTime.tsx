'use client';

import React, { useState, useEffect } from 'react';

interface MessageTimeProps {
  timestamp: string;
}

export function MessageTime({ timestamp }: MessageTimeProps) {
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    try {
      const d = new Date(timestamp);
      setFormatted(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setFormatted('');
    }
  }, [timestamp]);

  if (!formatted) return null;

  return (
    <span className="text-[10px] text-slate-400" suppressHydrationWarning>
      {formatted}
    </span>
  );
}
