'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  Video, Search, Plus, Clock, CheckCircle2, X, 
  Upload, Mic, Calendar, MapPin, Users, FileAudio,
  ChevronRight, Loader2, AlertCircle
} from 'lucide-react';

const statusColor = (s: string) => {
  const l = s?.toLowerCase();
  if (l === 'completed') return { bg: 'rgba(16,185,129,0.15)', color: '#10b981' };
  if (l === 'failed') return { bg: 'rgba(244,63,94,0.15)', color: '#f43f5e' };
  if (l === 'transcribed') return { bg: 'rgba(99,102,241,0.15)', color: '#818cf8' };
  if (l === 'uploaded') return { bg: 'rgba(14,165,233,0.15)', color: '#38bdf8' };
  return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' };
};

type CreateMode = 'type-select' | 'start-meeting' | 'upload-audio';

export default function MeetingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('type-select');
  const [creating, setCreating] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', venue: '', platform: '', 
    confidentiality: 'internal', language: 'en'
  });

  const isReadOnly = currentUser?.role?.toLowerCase() === 'leader';

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/');
      return;
    }
    api.getProfile().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => { loadMeetings(); }, [searchQuery, statusFilter]);

  const loadMeetings = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/');
      return;
    }
    setLoading(true);
    try {
      const results = await api.getMeetings({ search: searchQuery, status: statusFilter });
      setMeetings(results || []);
    } catch (e: any) { 
      if (e?.status === 401) {
        router.push('/');
        return;
      }
      console.error('Failed to load meetings:', e);
      setMeetings([]);
    } finally { 
      setLoading(false); 
    }
  };

  const resetModal = () => {
    setShowModal(false);
    setCreateMode('type-select');
    setAudioFile(null);
    setForm({ title: '', description: '', venue: '', platform: '', confidentiality: 'internal', language: 'en' });
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return alert('Please enter a meeting title.');
    setCreating(true);
    try {
      const meeting = await api.createMeeting({
        title: form.title,
        description: form.description,
        venue: form.venue,
        platform: form.platform,
        confidentiality: form.confidentiality,
        language: form.language,
        attendees: []
      });

      if (createMode === 'upload-audio' && audioFile) {
        await api.uploadMeetingAudio(meeting.id, audioFile);
      }

      resetModal();
      loadMeetings();
      router.push(`/meetings/${meeting.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to create meeting');
    } finally {
      setCreating(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10, 
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f5f9', fontSize: 14, outline: 'none'
  };

  return (
    <div style={{ padding: '32px', height: '100vh', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Meeting Intelligence</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>Transcribe, analyze, and summarize official consultations.</p>
        </div>
        {!isReadOnly && (
          <button className="btn-primary" onClick={() => { setShowModal(true); setCreateMode('type-select'); }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={18} /> New Meeting
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input className="input-field" placeholder="Search meetings..." style={{ paddingLeft: 36 }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="input-field" style={{ width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="uploaded">Uploaded</option>
          <option value="transcribed">Transcribed</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Meetings grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />)}
        </div>
      ) : meetings.length === 0 ? (
        <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📹</div>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>No meetings found</h3>
          <p style={{ color: '#64748b', marginTop: 8 }}>Create a new meeting to start transcribing and summarizing.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {meetings.map(m => {
            const sc = statusColor(m.status);
            return (
              <div key={m.id} className="glass-card active-hover" style={{ padding: 24, cursor: 'pointer' }} onClick={() => router.push(`/meetings/${m.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color, textTransform: 'uppercase' }}>{m.status}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{new Date(m.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4, marginBottom: 12 }}>{m.title}</h3>
                {m.description && <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{m.description}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                  {m.venue && <div style={{ display: 'flex', gap: 4, fontSize: 12, color: '#94a3b8', alignItems: 'center' }}><MapPin size={12} /> {m.venue}</div>}
                  {m.has_summary && <div style={{ display: 'flex', gap: 4, fontSize: 12, color: '#10b981', alignItems: 'center' }}><CheckCircle2 size={12} /> Summarized</div>}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#475569' }}>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Meeting Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: 540, maxHeight: '90vh', overflowY: 'auto', borderRadius: 20, padding: 32, position: 'relative' }}>
            <button onClick={resetModal} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}>
              <X size={18} />
            </button>

            {createMode === 'type-select' && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Create New Meeting</h2>
                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>How would you like to start?</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <button onClick={() => setCreateMode('start-meeting')} style={{ padding: 24, borderRadius: 16, border: '2px solid rgba(240,208,120,0.25)', background: 'rgba(240,208,120,0.05)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
                    onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f0d078'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(240,208,120,0.1)'; }}
                    onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(240,208,120,0.25)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(240,208,120,0.05)'; }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(240,208,120,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#f0d078' }}>
                      <Mic size={28} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#f1f5f9', marginBottom: 6 }}>Start Meeting</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Schedule a new meeting and record live audio</div>
                  </button>
                  <button onClick={() => setCreateMode('upload-audio')} style={{ padding: 24, borderRadius: 16, border: '2px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.05)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
                    onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#818cf8'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.1)'; }}
                    onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.25)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.05)'; }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#818cf8' }}>
                      <FileAudio size={28} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#f1f5f9', marginBottom: 6 }}>Upload Audio/Video</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Upload a recording for AI transcription & analysis</div>
                  </button>
                </div>
              </div>
            )}

            {(createMode === 'start-meeting' || createMode === 'upload-audio') && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: createMode === 'start-meeting' ? 'rgba(240,208,120,0.1)' : 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: createMode === 'start-meeting' ? '#f0d078' : '#818cf8' }}>
                    {createMode === 'start-meeting' ? <Mic size={20} /> : <FileAudio size={20} />}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>{createMode === 'start-meeting' ? 'Start New Meeting' : 'Upload Audio/Video'}</h2>
                    <p style={{ color: '#64748b', fontSize: 12 }}>{createMode === 'start-meeting' ? 'Fill in details to schedule your meeting' : 'Upload a recording to begin AI analysis'}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>MEETING TITLE *</label>
                    <input style={inputStyle} placeholder="e.g. District Development Review Meeting" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>DESCRIPTION</label>
                    <textarea style={{ ...inputStyle, height: 80, resize: 'none' }} placeholder="Brief agenda or context..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>VENUE</label>
                      <input style={inputStyle} placeholder="e.g. Mantralaya Room 5" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>PLATFORM</label>
                      <input style={inputStyle} placeholder="e.g. Zoom, Teams" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>CONFIDENTIALITY</label>
                      <select style={inputStyle} value={form.confidentiality} onChange={e => setForm(f => ({ ...f, confidentiality: e.target.value }))}>
                        <option value="public">Public</option>
                        <option value="internal">Internal</option>
                        <option value="confidential">Confidential</option>
                        <option value="restricted">Restricted</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>MEETING & SUMMARY LANGUAGE</label>
                      <select style={inputStyle} value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                        <option value="en">English</option>
                        <option value="hi">Hindi (हिन्दी)</option>
                        <option value="mr">Marathi (मराठी)</option>
                        <option value="ta">Tamil (தமிழ்)</option>
                        <option value="te">Telugu (తెలుగు)</option>
                        <option value="bn">Bengali (বাংলা)</option>
                        <option value="gu">Gujarati (ગુજરાતી)</option>
                        <option value="kn">Kannada (ಕನ್ನಡ)</option>
                        <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                        <option value="ur">Urdu (اردو)</option>
                      </select>
                    </div>
                  </div>

                  {createMode === 'upload-audio' && (
                    <div>
                      <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>AUDIO / VIDEO FILE</label>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', borderRadius: 12, border: `2px dashed ${audioFile ? '#818cf8' : 'rgba(255,255,255,0.1)'}`, background: audioFile ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', gap: 8, textAlign: 'center' }}>
                        {audioFile ? (
                          <>
                            <FileAudio size={28} color="#818cf8" />
                            <span style={{ fontSize: 13, color: '#818cf8', fontWeight: 600 }}>{audioFile.name}</span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>Click to change</span>
                          </>
                        ) : (
                          <>
                            <Upload size={28} color="#64748b" />
                            <span style={{ fontSize: 13, color: '#94a3b8' }}>Click to upload audio or video</span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>MP3, WAV, OGG, MP4, M4A, FLAC accepted (max 500MB)</span>
                          </>
                        )}
                        <input type="file" hidden accept=".mp3,.wav,.mp4,.m4a,.flac,.webm,.mkv,.ogg" onChange={e => setAudioFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button onClick={() => setCreateMode('type-select')} className="btn-secondary" style={{ flex: 1 }}>Back</button>
                    <button onClick={handleCreate} className="btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} disabled={creating}>
                      {creating ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Creating...</> : createMode === 'upload-audio' ? 'Create & Upload' : 'Start Meeting'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
