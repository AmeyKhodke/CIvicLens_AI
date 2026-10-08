'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, FileText, Video, Bot, Users, LogOut, ShieldCheck, Crown, Building2 } from 'lucide-react';
import api from '@/lib/api';

const ROLE_INFO: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  admin: { label: 'Admin', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: Crown },
  dept_head: { label: 'Dept Head', color: '#818cf8', bg: 'rgba(99,102,241,0.15)', icon: Building2 },
  secretary: { label: 'Secretary', color: '#38bdf8', bg: 'rgba(14,165,233,0.15)', icon: FileText },
  leader: { label: 'Public Leader (Read-Only)', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: ShieldCheck },
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUserProfile();
    const handleAuthChange = () => loadUserProfile();
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await api.getProfile();
      setUser(profile);
    } catch (e) {
      // Unauthenticated or network error
    }
  };

  const handleLogout = async () => {
    await api.logout();
    router.push('/');
  };

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Meetings', href: '/meetings', icon: Video },
    { name: 'AI Assistant', href: '/assistant', icon: Bot },
    ...(isAdmin ? [{ name: 'Users & RBAC', href: '/users', icon: Users }] : []),
  ];

  const roleMeta = ROLE_INFO[user?.role?.toLowerCase()] || ROLE_INFO['secretary'];
  const RoleIcon = roleMeta.icon;

  return (
    <div style={{
      width: 260,
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      background: 'rgba(10, 22, 40, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(212, 168, 67, 0.15)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Brand Header */}
      <div style={{ padding: '22px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(212,168,67,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          🏛️
        </div>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#f0d078', lineHeight: 1.2, margin: 0 }}>
            CivicLens AI
          </h1>
          <p style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '2px 0 0' }}>
            Governance Platform
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 16px',
                borderRadius: 12,
                color: isActive ? '#f0d078' : '#94a3b8',
                background: isActive ? 'rgba(212, 168, 67, 0.1)' : 'transparent',
                border: isActive ? '1px solid rgba(212, 168, 67, 0.2)' : '1px solid transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 500,
                fontSize: 13.5,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = '#cbd5e1';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#94a3b8';
                }
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Role Footer */}
      {user && (
        <div style={{ padding: '16px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: `${roleMeta.color}20`, color: roleMeta.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0
              }}>
                {user.full_name?.charAt(0) || user.username?.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.full_name}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  @{user.username}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              style={{
                background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
                padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              title="Sign Out"
              onMouseEnter={e => (e.currentTarget.style.color = '#fb7185')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
            >
              <LogOut size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 8px', borderRadius: 8,
              background: roleMeta.bg, color: roleMeta.color,
              fontSize: 10.5, fontWeight: 700, width: 'fit-content'
            }}>
              <RoleIcon size={12} />
              {roleMeta.label}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#10b981' }} title="Session active and TLS encrypted">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
              <span>TLS Active</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
