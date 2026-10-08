'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  FileText, 
  Video, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Search, 
  LogOut, 
  TrendingUp, 
  FileUp,
  MessageSquare,
  Shield,
  ShieldCheck,
  Crown,
  Building2,
  Lock,
  Mail,
  User,
  KeyRound,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Users
} from 'lucide-react';
import ActivityChart from '@/components/ActivityChart';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // PDF Upload State
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Auth UI state
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Login form
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // Register form
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    designation: '',
    department: '',
    role: 'secretary',
    contact: ''
  });

  // Forgot / Reset form
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setShowLogin(true);
      setLoading(false);
      return;
    }
    loadData();
  }, [searchQuery]);

  const loadData = async () => {
    try {
      const profile = await api.getProfile();
      setUser(profile);
      
      const [meetingsList, documentsList] = await Promise.all([
        api.getMeetings({ search: searchQuery }).catch(e => { if (e?.status !== 401) console.error(e); return []; }),
        api.getDocuments().catch(e => { if (e?.status !== 401) console.error(e); return []; }),
      ]);
      
      setMeetings(meetingsList || []);
      setDocuments(documentsList || []);
    } catch (e: any) {
      const isAuthError = 
        e.status === 401 || 
        e.message?.toLowerCase().includes('token') || 
        e.message?.includes('401') || 
        e.message?.toLowerCase().includes('unauthorized') || 
        e.message?.includes('403');

      if (isAuthError) {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth-change'));
        setShowLogin(true);
      } else {
        console.error('Data load failed:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    const u = customUser || loginForm.username;
    const p = customPass || loginForm.password;

    try {
      const res = await api.login(u, p);
      localStorage.setItem('token', res.access_token);
      setUser(res.user);
      window.dispatchEvent(new Event('auth-change'));
      setShowLogin(false);
      loadData();
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    try {
      await api.register(registerForm);
      setAuthSuccess('Account registered successfully! Please sign in with your credentials.');
      setAuthMode('login');
      setLoginForm({ username: registerForm.username, password: '' });
      setRegisterForm({
        username: '',
        email: '',
        password: '',
        full_name: '',
        designation: '',
        department: '',
        role: 'secretary',
        contact: '',
      });
      setAuthLoading(false);
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed.');
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) return;
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    try {
      const res = await api.forgotPassword(forgotIdentifier);
      setAuthSuccess(res.message + (res.demo_reset_code ? ` (Demo Code: ${res.demo_reset_code})` : ''));
      if (res.demo_reset_code) {
        setResetCode(res.demo_reset_code);
      }
      setAuthMode('reset');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to process password request.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    try {
      const res = await api.resetPassword({
        username_or_email: forgotIdentifier,
        reset_code: resetCode,
        new_password: newPassword
      });
      setAuthSuccess(res.message);
      setTimeout(() => {
        setAuthMode('login');
        setLoginForm({ username: forgotIdentifier, password: newPassword });
      }, 1500);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to reset password.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('auth-change'));
    setUser(null);
    setShowLogin(true);
    setMeetings([]);
    setDocuments([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingDoc(true);
    try {
      const res = await api.uploadDocument(file);
      router.push(`/documents/${res.id}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const isLeader = user?.role?.toLowerCase() === 'leader';
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  // ── Authentication Gateway (Login / Register / Forgot Pwd) ──
  if (showLogin) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 20%, #112240 0%, #070d18 70%, #030712 100%)',
        padding: '24px'
      }}>
        <div className="glass-card animate-slide-up" style={{ padding: '36px 40px', width: 460, maxWidth: '100%', borderRadius: 24, border: '1px solid rgba(212,168,67,0.25)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' }}>
          
          {/* Header Brand */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>
              🏛️
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f0d078', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              CivicLens AI
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
              AI Intelligence & Governance Co-Pilot Platform
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, marginBottom: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: authMode === 'login' ? 'linear-gradient(135deg, #d4a843, #e4bc5a)' : 'transparent',
                color: authMode === 'login' ? '#0a1628' : '#94a3b8', transition: 'all 0.2s'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess(''); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: authMode === 'register' ? 'linear-gradient(135deg, #d4a843, #e4bc5a)' : 'transparent',
                color: authMode === 'register' ? '#0a1628' : '#94a3b8', transition: 'all 0.2s'
              }}
            >
              Register
            </button>
          </div>

          {/* Official Security Notice */}
          <div style={{ marginBottom: 20, padding: '10px 14px', background: 'rgba(212,168,67,0.06)', borderRadius: 12, border: '1px solid rgba(212,168,67,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={18} color="#f0d078" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.4 }}>
              <span style={{ fontWeight: 700, color: '#f0d078' }}>Restricted Access:</span> Enter your authorized government credentials to access confidential records.
            </div>
          </div>

          {/* Feedback Messages */}
          {authError && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', color: '#fb7185', fontSize: 12.5, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} /> {authError}
            </div>
          )}
          {authSuccess && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399', fontSize: 12.5, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> {authSuccess}
            </div>
          )}

          {/* ── Form: Sign In ── */}
          {authMode === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 14, position: 'relative' }}>
                <input
                  className="input-field"
                  placeholder="Username or official email"
                  value={loginForm.username}
                  onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                  style={{ height: 46, fontSize: 13.5, borderRadius: 12, paddingLeft: 38 }}
                  required
                />
                <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              </div>

              <div style={{ marginBottom: 16, position: 'relative' }}>
                <input
                  className="input-field"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  style={{ height: 46, fontSize: 13.5, borderRadius: 12, paddingLeft: 38, paddingRight: 40 }}
                  required
                />
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthSuccess(''); }}
                  style={{ background: 'transparent', border: 'none', color: '#f0d078', fontSize: 12, cursor: 'pointer', padding: 0 }}
                >
                  Forgot Password?
                </button>
              </div>

              <button type="submit" className="btn-primary" disabled={authLoading} style={{ width: '100%', height: 46, borderRadius: 12, fontSize: 14, fontWeight: 700 }}>
                {authLoading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* ── Form: Register ── */}
          {authMode === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <input
                  className="input-field"
                  placeholder="Full Name"
                  required
                  value={registerForm.full_name}
                  onChange={e => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                  style={{ height: 42, fontSize: 13, borderRadius: 10 }}
                />
                <input
                  className="input-field"
                  placeholder="Username"
                  required
                  value={registerForm.username}
                  onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })}
                  style={{ height: 42, fontSize: 13, borderRadius: 10 }}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <input
                  className="input-field"
                  type="email"
                  placeholder="Official Email (@gov.in)"
                  required
                  value={registerForm.email}
                  onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                  style={{ height: 42, fontSize: 13, borderRadius: 10 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <input
                  className="input-field"
                  type="password"
                  placeholder="Password (min 6)"
                  required
                  value={registerForm.password}
                  onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                  style={{ height: 42, fontSize: 13, borderRadius: 10 }}
                />
                <select
                  className="input-field"
                  value={registerForm.role}
                  onChange={e => setRegisterForm({ ...registerForm, role: e.target.value })}
                  style={{ height: 42, fontSize: 13, borderRadius: 10 }}
                >
                  <option value="secretary">Secretary</option>
                  <option value="dept_head">Department Head</option>
                  <option value="leader">Public Leader (Read-Only)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <input
                  className="input-field"
                  placeholder="Designation"
                  value={registerForm.designation}
                  onChange={e => setRegisterForm({ ...registerForm, designation: e.target.value })}
                  style={{ height: 42, fontSize: 13, borderRadius: 10 }}
                />
                <input
                  className="input-field"
                  placeholder="Department"
                  value={registerForm.department}
                  onChange={e => setRegisterForm({ ...registerForm, department: e.target.value })}
                  style={{ height: 42, fontSize: 13, borderRadius: 10 }}
                />
              </div>

              <button type="submit" className="btn-primary" disabled={authLoading} style={{ width: '100%', height: 46, borderRadius: 12, fontSize: 14, fontWeight: 700 }}>
                {authLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* ── Form: Forgot Password ── */}
          {authMode === 'forgot' && (
            <form onSubmit={handleForgotPassword}>
              <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                Enter your username or registered email address to receive a secure password recovery code.
              </p>
              <div style={{ marginBottom: 16, position: 'relative' }}>
                <input
                  className="input-field"
                  placeholder="Username or email"
                  required
                  value={forgotIdentifier}
                  onChange={e => setForgotIdentifier(e.target.value)}
                  style={{ height: 46, fontSize: 13.5, borderRadius: 12, paddingLeft: 38 }}
                />
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setAuthMode('login')} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={authLoading} style={{ flex: 2 }}>
                  {authLoading ? 'Verifying...' : 'Get Reset Code'}
                </button>
              </div>
            </form>
          )}

          {/* ── Form: Reset Password ── */}
          {authMode === 'reset' && (
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Reset Verification Code</label>
                <input
                  className="input-field"
                  placeholder="e.g. CIVIC-1234"
                  required
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value)}
                  style={{ height: 42, fontSize: 13, borderRadius: 10 }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>New Password (min 6 chars)</label>
                <input
                  className="input-field"
                  type="password"
                  placeholder="Enter new password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ height: 42, fontSize: 13, borderRadius: 10 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setAuthMode('login')} style={{ flex: 1 }}>
                  Back to Login
                </button>
                <button type="submit" className="btn-primary" disabled={authLoading || !newPassword} style={{ flex: 2 }}>
                  {authLoading ? 'Updating...' : 'Set New Password'}
                </button>
              </div>
            </form>
          )}

          {/* Security Compliance Footnote */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#64748b', fontSize: 11 }}>
            <Lock size={12} color="#10b981" />
            <span>256-Bit TLS Encryption · ISO/IEC 27001 & RBAC Compliant</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated Main Dashboard ──
  return (
    <div style={{ padding: '32px', height: '100vh', overflowY: 'auto' }}>
      
      {/* Welcome Header & Clearance Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
              Welcome back, {user?.full_name?.split(' ')[0] || user?.username}
            </h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
              background: isLeader ? 'rgba(16,185,129,0.15)' : isAdmin ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
              color: isLeader ? '#10b981' : isAdmin ? '#f59e0b' : '#818cf8',
              border: `1px solid ${isLeader ? 'rgba(16,185,129,0.3)' : isAdmin ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`
            }}>
              {isLeader && <ShieldCheck size={13} />}
              {isAdmin && <Crown size={13} />}
              {!isLeader && !isAdmin && <Building2 size={13} />}
              {isLeader ? 'Public Leader (Read-Only)' : isAdmin ? 'System Administrator' : user?.designation || 'Governance Officer'}
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13.5, margin: 0 }}>
            {isLeader 
              ? 'Read-only intelligence dashboard: Review executive summaries, decisions, and ask AI.' 
              : 'Governance analytics, consultations, and document intelligence co-pilot.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && (
            <button 
              onClick={() => router.push('/users')} 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
            >
              <Users size={15} /> Manage Users
            </button>
          )}
          <button onClick={handleLogout} className="btn-icon" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 28 }}>
        {[
          { label: 'Total Meetings', value: meetings.length, icon: Video, color: '#8b5cf6', trend: 'Official sessions' },
          { label: 'Docs Processed', value: documents.length, icon: FileText, color: '#10b981', trend: 'RAG indexed' },
          { label: 'AI Intelligence', value: 'Active', icon: MessageSquare, color: '#f59e0b', trend: 'Groq & Vector Search' },
          { label: 'Security Clearance', value: user?.role?.toUpperCase() || 'STANDARD', icon: Shield, color: '#3b82f6', trend: isLeader ? 'Read-Only' : 'Full Control' },
        ].map((stat, i) => (
          <div key={i} className="glass-card" style={{ padding: 22, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ 
                width: 44, height: 44, borderRadius: 12, 
                background: stat.color + '15', display: 'flex', 
                alignItems: 'center', justifyContent: 'center', color: stat.color 
              }}>
                <stat.icon size={22} />
              </div>
              <span style={{ fontSize: 11, color: '#64748b', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 4 }}>
                {stat.trend}
              </span>
            </div>
            <h3 style={{ fontSize: 26, fontWeight: 800, marginBottom: 3, color: '#f1f5f9' }}>{stat.value}</h3>
            <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500, margin: 0 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts & Actions Row */}
      <div style={{ display: 'grid', gridTemplateColumns: isLeader ? '1fr' : '2fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Activity Chart */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              <TrendingUp size={18} color="#f0d078" /> Activity & Consultation Flow
            </h2>
            <div style={{ fontSize: 12, color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 8 }}>
              Past 7 Days
            </div>
          </div>
          <div style={{ height: 230, width: '100%' }}>
            <ActivityChart />
          </div>
        </div>

        {/* Quick Actions (Hidden for Public Leader - Read Only role) */}
        {!isLeader && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Quick PDF Upload */}
            <div className="glass-card" style={{ 
              padding: 22, flex: 1, border: '1px dashed rgba(212, 168, 67, 0.25)', 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center'
            }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: '50%', background: 'rgba(212, 168, 67, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078',
                marginBottom: 12
              }}>
                <FileUp size={24} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, margin: '0 0 4px' }}>Quick PDF Upload</h3>
              <p style={{ color: '#64748b', fontSize: 12, marginBottom: 14 }}>
                Process reports, audit memos, or official records.
              </p>
              <label className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '8px 16px' }}>
                {uploadingDoc ? 'Uploading...' : 'Choose Document'}
                <input type="file" hidden accept=".pdf,.docx,.txt" onChange={handleFileUpload} disabled={uploadingDoc} />
              </label>
            </div>

            {/* New Meeting Shortcut */}
            <button 
              className="glass-card" 
              onClick={() => router.push('/meetings')}
              style={{ 
                padding: 18, width: '100%', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 14, border: '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <div style={{ 
                width: 40, height: 40, borderRadius: 10, background: 'rgba(139, 92, 246, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6'
              }}>
                <Plus size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Create New Meeting</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Start a fresh audio/video transcription</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Recent Activities List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Recent Activities & Consultations</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input 
                className="input-field" 
                placeholder="Search records..." 
                style={{ paddingLeft: 36, width: 220, height: 36, fontSize: 13, borderRadius: 8 }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 14 }} />)}
          </div>
        ) : meetings.length === 0 ? (
          <div className="glass-card" style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
             <p>No recent activities found.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {meetings.slice(0, 6).map((meeting) => (
              <div 
                key={meeting.id} 
                className="glass-card active-hover" 
                style={{ padding: 18, cursor: 'pointer', borderRadius: 14 }}
                onClick={() => router.push(`/meetings/${meeting.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span className={`badge badge-${meeting.status}`} style={{ fontSize: 10 }}>{meeting.status}</span>
                  <span style={{ fontSize: 11.5, color: '#64748b' }}>{new Date(meeting.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
                <h3 style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10, lineHeight: 1.4, color: '#f1f5f9' }}>{meeting.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#94a3b8' }}>
                    <Clock size={13} /> {meeting.duration_seconds ? `${Math.floor(meeting.duration_seconds/60)}m` : '--'}
                  </div>
                  {meeting.has_summary && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#10b981' }}>
                      <CheckCircle2 size={13} /> Summarized
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
