'use client';

import { ReactNode } from 'react';

interface TradingLayoutProps {
  children: ReactNode;
}

export function TradingLayout({ children }: TradingLayoutProps) {
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-background">
      {children}
    </div>
  );
}