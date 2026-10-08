'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from "./Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    const authed = !!token;
    setIsAuthenticated(authed);

    // If not authed and not on login page (/), redirect to login
    if (!authed && pathname !== '/') {
      router.push('/');
    }

    const handleStorageChange = () => {
      const currentToken = localStorage.getItem('token');
      const isAuth = !!currentToken;
      setIsAuthenticated(isAuth);
      if (!isAuth && pathname !== '/') {
        router.push('/');
      }
    };

    // ── Idle Session Timeout (Auto-logout on 30 min inactivity) ──
    const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (localStorage.getItem('token')) {
        idleTimer = setTimeout(() => {
          localStorage.removeItem('token');
          window.dispatchEvent(new Event('auth-change'));
          alert('Security Alert: Your session timed out due to 30 minutes of inactivity.');
          router.push('/');
        }, IDLE_TIMEOUT_MS);
      }
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-change', handleStorageChange);

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleStorageChange);
    };
  }, [pathname, router]);

  // Before mounting, render simple container to ensure SSR matches client initial render
  if (!mounted) {
    return <div style={{ background: '#0a1628', minHeight: '100vh' }}>{children}</div>;
  }

  // If user is not authenticated and trying to access a protected page, show loading while redirecting to /
  if (!isAuthenticated && pathname !== '/') {
    return (
      <div style={{ background: '#0a1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>🔒</div>
          <p style={{ fontSize: 14 }}>Authenticating... redirecting to login</p>
        </div>
      </div>
    );
  }

  // Dashboard layout for authenticated users
  if (isAuthenticated) {
    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <main style={{ marginLeft: 260, flex: 1, height: '100vh', overflow: 'hidden', background: '#0a1628', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>
    );
  }

  // Pure children view for unauthenticated (the root login page /)
  return <>{children}</>;
}
