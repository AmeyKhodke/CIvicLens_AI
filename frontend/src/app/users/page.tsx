'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  Users, UserPlus, Shield, ShieldCheck, ShieldAlert, 
  Search, Filter, KeyRound, Check, X, Edit3, Trash2, 
  Lock, RefreshCw, AlertCircle, CheckCircle2, UserCheck, 
  UserX, Crown, Briefcase, FileText, Building2
} from 'lucide-react';

interface UserItem {
  id: string;
  username: string;
  email: string;
  full_name: string;
  designation: string;
  department: string;
  role: string;
  contact: string;
  is_active: boolean;
  created_at?: string;
}

const ROLE_BADGES: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  admin: { label: 'System Admin', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', icon: Crown },
  dept_head: { label: 'Department Head', color: '#818cf8', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.3)', icon: Building2 },
  secretary: { label: 'Secretary', color: '#38bdf8', bg: 'rgba(14,165,233,0.15)', border: 'rgba(14,165,233,0.3)', icon: FileText },
  leader: { label: 'Public Leader (Read-Only)', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', icon: ShieldCheck },
};

export default function UsersManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    designation: '',
    department: '',
    role: 'secretary',
    contact: '',
    is_active: true,
  });

  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    designation: '',
    department: '',
    role: 'secretary',
    contact: '',
    is_active: true,
  });

  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkAuthAndLoad();
  }, [roleFilter, searchQuery]);

  const checkAuthAndLoad = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/');
      return;
    }
    setLoading(true);
    try {
      const profile = await api.getProfile();
      setCurrentUser(profile);

      // Access control guard
      const r = (profile.role || '').toLowerCase();
      if (r !== 'admin') {
        router.push('/');
        setLoading(false);
        return;
      }

      const usersList = await api.getUsers({
        role: roleFilter !== 'all' ? roleFilter : undefined,
        search: searchQuery || undefined,
      });
      setUsers(usersList);
    } catch (e: any) {
      if (e?.status === 401) {
        router.push('/');
        return;
      }
      console.error('Users load failed:', e);
      setAlertMsg({ type: 'error', text: e.message || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.createUser(createForm);
      setShowCreateModal(false);
      setCreateForm({
        username: '', email: '', password: '', full_name: '',
        designation: '', department: '', role: 'secretary', contact: '', is_active: true,
      });
      setAlertMsg({ type: 'success', text: `User "${createForm.username}" created successfully.` });
      checkAuthAndLoad();
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await api.updateUser(selectedUser.id, editForm);
      setShowEditModal(false);
      setSelectedUser(null);
      setAlertMsg({ type: 'success', text: `User "${selectedUser.username}" updated successfully.` });
      checkAuthAndLoad();
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    setActionLoading(true);
    try {
      await api.adminResetPassword(selectedUser.id, newPassword);
      setShowResetModal(false);
      setNewPassword('');
      setSelectedUser(null);
      setAlertMsg({ type: 'success', text: `Password for "${selectedUser.username}" reset successfully.` });
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (u: UserItem) => {
    if (u.id === currentUser?.id) {
      alert('You cannot deactivate your own administrative account.');
      return;
    }
    const newStatus = !u.is_active;
    try {
      await api.updateUser(u.id, { is_active: newStatus });
      setUsers(prev => prev.map(item => item.id === u.id ? { ...item, is_active: newStatus } : item));
      setAlertMsg({ type: 'success', text: `User "${u.username}" is now ${newStatus ? 'Active' : 'Deactivated'}.` });
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (u: UserItem) => {
    if (u.id === currentUser?.id) {
      alert('You cannot delete your own administrative account.');
      return;
    }
    if (!confirm(`Are you sure you want to delete user "${u.username}" (${u.full_name})?`)) return;
    try {
      await api.deleteUser(u.id);
      setUsers(prev => prev.filter(item => item.id !== u.id));
      setAlertMsg({ type: 'success', text: `User "${u.username}" has been removed.` });
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const openEditModal = (u: UserItem) => {
    setSelectedUser(u);
    setEditForm({
      full_name: u.full_name,
      email: u.email,
      designation: u.designation || '',
      department: u.department || '',
      role: u.role,
      contact: u.contact || '',
      is_active: u.is_active,
    });
    setShowEditModal(true);
  };

  const openResetModal = (u: UserItem) => {
    setSelectedUser(u);
    setNewPassword('');
    setShowResetModal(true);
  };

  // Non-admin guard
  if (!loading && currentUser && currentUser.role?.toLowerCase() !== 'admin') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a1628', padding: 24 }}>
        <div className="glass-card" style={{ maxWidth: 480, padding: 40, textAlign: 'center', borderRadius: 20 }}>
          <ShieldAlert size={54} color="#f43f5e" style={{ margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Access Restricted</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            User Authentication and Role-Based Access Control (RBAC) management is restricted to <strong>System Administrators</strong> only.
          </p>
          <button className="btn-primary" onClick={() => router.push('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', height: '100vh', overflowY: 'auto', background: 'linear-gradient(180deg, #070d18 0%, #0a1628 100%)' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(212,168,67,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078' }}>
              <Users size={20} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              User & Access Control (RBAC)
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
            Manage governance officers, assigned security clearance roles, and credentials.
          </p>
        </div>

        <button 
          className="btn-primary" 
          onClick={() => setShowCreateModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontSize: 13.5 }}
        >
          <UserPlus size={17} /> Add New User
        </button>
      </div>

      {/* Status / Alert Banner */}
      {alertMsg && (
        <div style={{
          padding: '12px 18px', borderRadius: 12, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: alertMsg.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
          border: `1px solid ${alertMsg.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
          color: alertMsg.type === 'success' ? '#10b981' : '#f43f5e', fontSize: 13.5
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {alertMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{alertMsg.text}</span>
          </div>
          <button onClick={() => setAlertMsg(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Role Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Users', count: users.length, icon: Users, color: '#f0d078', sub: 'Registered accounts' },
          { label: 'System Admins', count: users.filter(u => u.role === 'admin').length, icon: Crown, color: '#f59e0b', sub: 'Full access' },
          { label: 'Dept Heads & Staff', count: users.filter(u => ['dept_head', 'secretary'].includes(u.role)).length, icon: Building2, color: '#818cf8', sub: 'Operational' },
          { label: 'Public Leaders', count: users.filter(u => u.role === 'leader').length, icon: ShieldCheck, color: '#10b981', sub: 'Read-only observer' },
        ].map((stat, idx) => (
          <div key={idx} className="glass-card" style={{ padding: '18px 20px', borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>{stat.label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                <stat.icon size={16} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc', marginBottom: 2 }}>{stat.count}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input 
            className="input-field" 
            placeholder="Search by name, username, email, or department..." 
            style={{ paddingLeft: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }} 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
        </div>

        <select 
          className="input-field" 
          style={{ width: 220, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }} 
          value={roleFilter} 
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="dept_head">Department Head</option>
          <option value="secretary">Secretary</option>
          <option value="leader">Public Leader (Read-Only)</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="glass-card" style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading users database...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
            <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: '#cbd5e1' }}>No users found</p>
            <p style={{ fontSize: 13 }}>Try adjusting your search query or role filter.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '14px 20px' }}>User Details</th>
                <th style={{ padding: '14px 20px' }}>Role Clearance</th>
                <th style={{ padding: '14px 20px' }}>Department & Title</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => {
                const badge = ROLE_BADGES[u.role] || ROLE_BADGES['secretary'];
                const RoleIcon = badge.icon;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* User Details */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ 
                          width: 38, height: 38, borderRadius: '50%', 
                          background: `${badge.color}20`, color: badge.color, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          fontWeight: 700, fontSize: 14 
                        }}>
                          {u.full_name?.charAt(0) || u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{u.full_name}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>@{u.username} · {u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role Clearance */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                        background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`
                      }}>
                        <RoleIcon size={13} />
                        {badge.label}
                      </span>
                    </td>

                    {/* Department & Title */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 500 }}>{u.designation || '--'}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{u.department || 'General Administration'}</div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '16px 20px' }}>
                      <button
                        onClick={() => handleToggleActive(u)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 9px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                          background: u.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                          color: u.is_active ? '#10b981' : '#f43f5e',
                          border: `1px solid ${u.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                          cursor: 'pointer'
                        }}
                        title="Click to toggle status"
                      >
                        {u.is_active ? <UserCheck size={12} /> : <UserX size={12} />}
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          onClick={() => openEditModal(u)}
                          className="btn-secondary"
                          style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          title="Edit User Details"
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                        <button
                          onClick={() => openResetModal(u)}
                          className="btn-secondary"
                          style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: '#f0d078', borderColor: 'rgba(212,168,67,0.2)' }}
                          title="Reset Password"
                        >
                          <KeyRound size={13} /> Reset Pwd
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 12, color: '#fb7185', borderColor: 'rgba(244,63,94,0.25)' }}
                            title="Delete User"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
          onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}
        >
          <div className="glass-card animate-slide-up" style={{ width: 520, padding: 32, borderRadius: 18, border: '1px solid rgba(212,168,67,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f0d078', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={20} /> Create New Governance Account
              </h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Full Name *</label>
                  <input className="input-field" required value={createForm.full_name} onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })} placeholder="e.g. Anand Deshmukh" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Username *</label>
                  <input className="input-field" required value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} placeholder="e.g. adeshmukh" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Email Address *</label>
                  <input className="input-field" type="email" required value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="officer@gov.in" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Password *</label>
                  <input className="input-field" type="password" required value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Min 6 characters" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Role & Clearance *</label>
                  <select className="input-field" value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })}>
                    <option value="admin">System Admin</option>
                    <option value="dept_head">Department Head</option>
                    <option value="secretary">Secretary</option>
                    <option value="leader">Public Leader (Read-Only)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Contact Number</label>
                  <input className="input-field" value={createForm.contact} onChange={e => setCreateForm({ ...createForm, contact: e.target.value })} placeholder="+91 98765 43210" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Designation</label>
                  <input className="input-field" value={createForm.designation} onChange={e => setCreateForm({ ...createForm, designation: e.target.value })} placeholder="e.g. Under Secretary" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Department</label>
                  <input className="input-field" value={createForm.department} onChange={e => setCreateForm({ ...createForm, department: e.target.value })} placeholder="e.g. Finance & Planning" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
          onClick={e => e.target === e.currentTarget && setShowEditModal(false)}
        >
          <div className="glass-card animate-slide-up" style={{ width: 500, padding: 32, borderRadius: 18, border: '1px solid rgba(212,168,67,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f0d078', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={20} /> Edit User: @{selectedUser.username}
              </h2>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditUser}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Full Name</label>
                <input className="input-field" required value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Email</label>
                  <input className="input-field" type="email" required value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Role & Clearance</label>
                  <select className="input-field" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                    <option value="admin">System Admin</option>
                    <option value="dept_head">Department Head</option>
                    <option value="secretary">Secretary</option>
                    <option value="leader">Public Leader (Read-Only)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Designation</label>
                  <input className="input-field" value={editForm.designation} onChange={e => setEditForm({ ...editForm, designation: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Department</label>
                  <input className="input-field" value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })} />
                  Active Account (can log in and access system)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {showResetModal && selectedUser && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
          onClick={e => e.target === e.currentTarget && setShowResetModal(false)}
        >
          <div className="glass-card animate-slide-up" style={{ width: 420, padding: 32, borderRadius: 18, border: '1px solid rgba(212,168,67,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f0d078', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={18} /> Reset Password
              </h2>
              <button onClick={() => setShowResetModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
              Set a new password for <strong>{selectedUser.full_name}</strong> (<code>@{selectedUser.username}</code>).
            </p>

            <form onSubmit={handleResetPassword}>
              <input
                className="input-field"
                type="password"
                placeholder="Enter new password (min 6 chars)"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ marginBottom: 20 }}
              />

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowResetModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={actionLoading || !newPassword}>
                  {actionLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
