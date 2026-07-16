import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-[380px]">{children}</div>
    </main>
  );
};
