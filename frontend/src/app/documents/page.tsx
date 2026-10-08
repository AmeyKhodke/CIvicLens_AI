'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  FileText, FileUp, BrainCircuit, Loader2, CheckCircle2, 
  AlertCircle, RefreshCw, MessageSquare, Send, X, Trash2,
  Copy, Check, Globe, Sparkles, HelpCircle, Layers, FileCode,
  PanelLeftClose, PanelLeft, Columns, BookOpen, BarChart3
} from 'lucide-react';
import ExecutiveSummaryView from '@/components/ExecutiveSummaryView';
import RAGEvaluationView from '@/components/RAGEvaluationView';
import FormattedMessage from '@/components/FormattedMessage';

const statusColor = (s: string) => {
  const l = s?.toLowerCase();
  if (l === 'ready') return { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.3)' };
  if (l === 'failed') return { bg: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: 'rgba(244,63,94,0.3)' };
  return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' };
};

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
];

const SUGGESTED_PROMPTS = [
  { label: '📊 Key Findings', prompt: 'List the key findings and main summary points of this document.' },
  { label: '📄 Page Count & Info', prompt: 'No. of pages in the document and document metadata?' },
  { label: '💰 Budget & Financials', prompt: 'What are the key financial, budgetary, or revenue figures mentioned?' },
  { label: '⚠️ Audit / Issues', prompt: 'What are the main issues, misappropriations, or risks highlighted?' },
  { label: '✅ Action Items', prompt: 'What decisions, recommendations, or action items are proposed?' },
];

export default function DocumentsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  
  // Layout views: 'split' | 'summary' | 'chat' | 'evaluation'
  const [activeTab, setActiveTab] = useState<'split' | 'summary' | 'chat' | 'evaluation'>('split');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadLang, setUploadLang] = useState('en');
  const [uploading, setUploading] = useState(false);
  
  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Chat state
  const [chatLang, setChatLang] = useState('en');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  
  // Copy state
  const [copied, setCopied] = useState(false);

  const isReadOnly = currentUser?.role?.toLowerCase() === 'leader';

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/');
      return;
    }
    api.getProfile().then(setCurrentUser).catch(() => {});
    loadDocs();
  }, []);

  // Smooth scroll to bottom on new message or loading change
  useEffect(() => {
    if (chatMessages.length > 0 || chatLoading) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, chatLoading]);

  // Poll selectedDoc status if processing
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (selectedDoc && ['uploaded', 'processing', 'pending'].includes(selectedDoc.status?.toLowerCase())) {
      pollRef.current = setInterval(async () => {
        try {
          const updated = await api.getDocument(selectedDoc.id);
          setSelectedDoc(updated);
          setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d));
          if (['ready', 'failed'].includes(updated.status?.toLowerCase())) {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (e: any) {
          if (e?.status === 401) {
            router.push('/');
          }
        }
      }, 2500);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedDoc?.id, selectedDoc?.status]);

  const loadDocs = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/');
      return;
    }
    try {
      const docs = await api.getDocuments();
      setDocuments(docs || []);
      if (docs && docs.length > 0 && !selectedDoc) {
        setSelectedDoc(docs[0]);
        if (docs[0].language) setChatLang(docs[0].language);
      }
    } catch (e: any) {
      if (e?.status === 401) {
        router.push('/');
        return;
      }
      console.error('Failed to load documents:', e);
    } finally {
      setLoading(false);
    }
  };

  // Load chat messages from localStorage whenever selectedDoc changes
  useEffect(() => {
    if (selectedDoc?.id) {
      try {
        const saved = localStorage.getItem(`civiclens_doc_chat_${selectedDoc.id}`);
        if (saved) {
          setChatMessages(JSON.parse(saved));
        } else {
          setChatMessages([]);
        }
      } catch (e) {
        setChatMessages([]);
      }
    }
  }, [selectedDoc?.id]);

  // Save chat messages to localStorage whenever chatMessages changes
  const updateMessagesAndStore = (newMsgs: any[]) => {
    setChatMessages(newMsgs);
    if (selectedDoc?.id) {
      try {
        localStorage.setItem(`civiclens_doc_chat_${selectedDoc.id}`, JSON.stringify(newMsgs));
      } catch (e) {
        console.error('Failed to save chat to localStorage', e);
      }
    }
  };

  const handleClearChat = () => {
    if (!selectedDoc?.id) return;
    if (chatMessages.length === 0) return;
    if (confirm('Clear chat conversation history for this document?')) {
      setChatMessages([]);
      localStorage.removeItem(`civiclens_doc_chat_${selectedDoc.id}`);
    }
  };

  const handleSelectDoc = async (doc: any) => {
    setChatInput('');
    if (doc.language) setChatLang(doc.language);
    if (doc.status?.toLowerCase() === 'ready' && !doc.summary) {
      const fresh = await api.getDocument(doc.id).catch(() => doc);
      setSelectedDoc(fresh);
    } else {
      setSelectedDoc(doc);
    }
  };

  const handleDeleteDoc = async (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;
    setDeletingId(docId);
    try {
      await api.deleteDocument(docId);
      localStorage.removeItem(`civiclens_doc_chat_${docId}`);
      const remaining = documents.filter(d => d.id !== docId);
      setDocuments(remaining);
      if (selectedDoc?.id === docId) {
        setSelectedDoc(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    try {
      const res = await api.uploadDocument(uploadFile, uploadTitle || uploadFile.name, uploadLang);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle('');
      await loadDocs();
      setSelectedDoc(res);
      setChatLang(uploadLang);
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleChat = async (e: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const query = customPrompt || chatInput;
    if (!query.trim() || chatLoading || !selectedDoc) return;
    
    const userMsg = { role: 'user', content: query };
    const updatedWithUser = [...chatMessages, userMsg];
    updateMessagesAndStore(updatedWithUser);
    
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await api.chatWithDocument(selectedDoc.id, query, chatLang);
      const assistantMsg = { role: 'assistant', content: res.answer, sources: res.sources };
      updateMessagesAndStore([...updatedWithUser, assistantMsg]);
    } catch (err: any) {
      const errorMsg = { role: 'assistant', content: `Error: ${err.message}` };
      updateMessagesAndStore([...updatedWithUser, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCopySummary = () => {
    if (!selectedDoc?.summary) return;
    navigator.clipboard.writeText(selectedDoc.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isReady = selectedDoc?.status?.toLowerCase() === 'ready';
  const isProcessing = ['uploaded', 'processing', 'pending'].includes(selectedDoc?.status?.toLowerCase());

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #070d18 0%, #0a1628 100%)', color: '#f1f5f9' }}>
      
      {/* Top Navigation / Header */}
      <header style={{ 
        padding: '16px 28px', 
        borderBottom: '1px solid rgba(212, 168, 67, 0.12)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: 'rgba(10, 22, 40, 0.75)',
        backdropFilter: 'blur(16px)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Show file list" : "Hide file list"}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#f0d078',
              borderRadius: 8,
              padding: 7,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            {sidebarCollapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
          </button>

          <div style={{ 
            width: 38, height: 38, borderRadius: 10, 
            background: 'linear-gradient(135deg, rgba(212,168,67,0.25), rgba(212,168,67,0.05))',
            border: '1px solid rgba(212,168,67,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078',
            boxShadow: '0 4px 16px rgba(212,168,67,0.1)'
          }}>
            <BrainCircuit size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#f0d078', letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              Document Intelligence
              <span style={{ fontSize: 10, background: 'rgba(212,168,67,0.15)', color: '#f0d078', border: '1px solid rgba(212,168,67,0.3)', padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>
                RAG Engine v2.0
              </span>
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 1, margin: 0 }}>
              AI Executive Summaries & Vector-Powered Deep Q&A in English, मराठी & हिन्दी
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* View Mode Switcher */}
          {selectedDoc && (
            <div style={{ 
              display: 'flex', 
              background: 'rgba(255, 255, 255, 0.04)', 
              padding: 3, 
              borderRadius: 10, 
              border: '1px solid rgba(255, 255, 255, 0.08)' 
            }}>
              {[
                { id: 'split', label: 'Split View', icon: <Columns size={13} /> },
                { id: 'summary', label: 'Summary Focus', icon: <BookOpen size={13} /> },
                { id: 'chat', label: 'AI Chat Focus', icon: <MessageSquare size={13} /> },
                { id: 'evaluation', label: 'RAG Evaluation', icon: <BarChart3 size={13} /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    background: activeTab === tab.id ? 'linear-gradient(135deg, #d4a843, #e4bc5a)' : 'transparent',
                    color: activeTab === tab.id ? '#0a1628' : '#cbd5e1',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          )}

          {!isReadOnly && (
            <button 
              onClick={() => setShowUploadModal(true)} 
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 9, fontWeight: 600, fontSize: 12.5 }}
            >
              <FileUp size={15} /> Upload Document
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div style={{ 
        flex: 1, 
        minHeight: 0, 
        display: 'grid', 
        gridTemplateColumns: sidebarCollapsed ? '0px 1fr' : '310px 1fr', 
        overflow: 'hidden',
        transition: 'grid-template-columns 0.25s ease'
      }}>
        
        {/* Left Sidebar: Document List */}
        {!sidebarCollapsed && (
          <aside style={{ 
            height: '100%',
            minHeight: 0,
            borderRight: '1px solid rgba(255, 255, 255, 0.06)', 
            overflowY: 'auto', 
            padding: 14,
            background: 'rgba(7, 13, 24, 0.45)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Uploaded Files ({documents.length})
              </span>
              <button 
                onClick={loadDocs} 
                title="Refresh documents" 
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12, marginBottom: 8 }} />
              ))
            ) : documents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
                <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ fontSize: 13, margin: 0 }}>No documents uploaded yet.</p>
                {!isReadOnly && (
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    style={{ marginTop: 12, fontSize: 12, color: '#f0d078', background: 'transparent', border: '1px dashed rgba(212,168,67,0.3)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}
                  >
                    + Upload your first PDF
                  </button>
                )}
              </div>
            ) : (
              documents.map(doc => {
                const sc = statusColor(doc.status);
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDoc(doc)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      marginBottom: 8,
                      cursor: 'pointer',
                      background: isSelected 
                        ? 'linear-gradient(135deg, rgba(212, 168, 67, 0.16) 0%, rgba(212, 168, 67, 0.04) 100%)' 
                        : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isSelected ? 'rgba(212, 168, 67, 0.35)' : 'rgba(255, 255, 255, 0.05)'}`,
                      boxShadow: isSelected ? '0 4px 16px rgba(0, 0, 0, 0.3)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                        <div style={{ 
                          width: 32, height: 32, borderRadius: 8, 
                          background: isSelected ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.04)', 
                          border: `1px solid ${isSelected ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          color: isSelected ? '#f0d078' : '#94a3b8', 
                          flexShrink: 0 
                        }}>
                          <FileText size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ 
                            fontWeight: isSelected ? 700 : 600, 
                            fontSize: 12.5, 
                            color: isSelected ? '#f0d078' : '#e2e8f0', 
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' 
                          }}>
                            {doc.title || doc.filename}
                          </div>
                          <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span>{doc.file_type?.toUpperCase()}</span>
                            {doc.page_count && <span>· {doc.page_count} pgs</span>}
                            <span>· {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span style={{ 
                          fontSize: 8.5, fontWeight: 700, padding: '2px 6px', borderRadius: 20, 
                          background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                          whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em'
                        }}>
                          {doc.status}
                        </span>
                        {!isReadOnly && (
                          <button
                            onClick={(e) => handleDeleteDoc(doc.id, e)}
                            disabled={deletingId === doc.id}
                            title="Delete document"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              padding: 3,
                              borderRadius: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#fb7185'; e.currentTarget.style.background = 'rgba(244,63,94,0.15)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; }}
                          >
                            {deletingId === doc.id ? (
                              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </aside>
        )}

        {/* Right Workspace: Executive Summary & RAG Q&A Chat */}
        {!selectedDoc ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: '#64748b' }}>
            <BrainCircuit size={56} style={{ opacity: 0.25, color: '#f0d078' }} />
            <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Select an uploaded document to view executive summary and RAG AI chat</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
            
            {/* Document Profile Header Bar */}
            <div style={{ 
              padding: '14px 28px', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              background: 'rgba(10, 22, 40, 0.45)',
              flexShrink: 0
            }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                  {selectedDoc.title || selectedDoc.filename}
                </h2>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>
                    {selectedDoc.file_type?.toUpperCase()}
                  </span>
                  {selectedDoc.page_count && (
                    <span style={{ fontSize: 11.5, color: '#f0d078', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      📄 {selectedDoc.page_count} Pages
                    </span>
                  )}
                  {selectedDoc.file_size ? (
                    <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                      💾 {(selectedDoc.file_size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  ) : null}
                  <span style={{ 
                    fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, 
                    background: statusColor(selectedDoc.status).bg, color: statusColor(selectedDoc.status).color,
                    display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase'
                  }}>
                    {isReady && <CheckCircle2 size={11} />}
                    {isProcessing && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                    {selectedDoc?.status?.toLowerCase() === 'failed' && <AlertCircle size={11} />}
                    {selectedDoc.status}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isProcessing && (
                  <button 
                    onClick={() => handleSelectDoc(selectedDoc)} 
                    className="btn-secondary" 
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
                  >
                    <RefreshCw size={13} /> Refresh Status
                  </button>
                )}
                {isReady && selectedDoc.summary && (
                  <button 
                    onClick={handleCopySummary} 
                    className="btn-secondary" 
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
                  >
                    {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    {copied ? 'Copied!' : 'Copy Summary'}
                  </button>
                )}
                {!isReadOnly && (
                  <button
                    onClick={() => handleDeleteDoc(selectedDoc.id)}
                    disabled={deletingId === selectedDoc.id}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px', color: '#fb7185', borderColor: 'rgba(244,63,94,0.25)' }}
                  >
                    {deletingId === selectedDoc.id ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Content Area with View Mode Adaptations */}
            {activeTab === 'evaluation' ? (
              <div style={{ flex: 1, height: '100%', minHeight: 0, overflow: 'hidden' }}>
                <RAGEvaluationView document={selectedDoc} isReadOnly={isReadOnly} />
              </div>
            ) : (
              <div style={{ 
                flex: 1, 
                minHeight: 0, 
                height: '100%', 
                display: activeTab === 'split' ? 'grid' : 'flex', 
                gridTemplateColumns: activeTab === 'split' ? '1.1fr 1fr' : undefined, 
                overflow: 'hidden' 
              }}>
                
                {/* Left Column: Executive Summary */}
                {(activeTab === 'split' || activeTab === 'summary') && (
                <div style={{ 
                  flex: 1,
                  height: '100%', 
                  minHeight: 0, 
                  padding: 24, 
                  overflowY: 'auto', 
                  borderRight: activeTab === 'split' ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                  maxWidth: activeTab === 'summary' ? 1080 : '100%',
                  margin: activeTab === 'summary' ? '0 auto' : '0',
                  width: '100%'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f0d078', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={16} /> AI Executive Summary
                    </h3>
                    {selectedDoc.language && (
                      <span style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Globe size={12} /> {LANGUAGES.find(l => l.code === selectedDoc.language)?.native || selectedDoc.language}
                      </span>
                    )}
                  </div>

                  {isReady && selectedDoc.summary ? (
                    <ExecutiveSummaryView 
                      summary={selectedDoc.summary}
                      title={selectedDoc.title || selectedDoc.filename}
                      language={selectedDoc.language}
                      pageCount={selectedDoc.page_count}
                      fileName={selectedDoc.filename}
                    />
                  ) : isReady && !selectedDoc.summary ? (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px', borderRadius: 14, background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255,255,255,0.07)', color: '#64748b' }}>
                      <BrainCircuit size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                      <p>Summary not generated yet. You can still ask questions about this document on the right.</p>
                    </div>
                  ) : selectedDoc?.status?.toLowerCase() === 'failed' ? (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '32px 16px', borderRadius: 14, background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <AlertCircle size={32} color="#f43f5e" style={{ margin: '0 auto 12px' }} />
                      <p style={{ color: '#fb7185', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Processing Failed</p>
                      <p style={{ color: '#94a3b8', fontSize: 13 }}>{selectedDoc.summary || 'An error occurred during background ingestion. Please re-upload.'}</p>
                    </div>
                  ) : (
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, gap: 14, borderRadius: 14, background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ position: 'relative', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 size={36} style={{ color: '#f0d078', animation: 'spin 1.2s linear infinite' }} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#f0d078', fontWeight: 700, marginBottom: 4, fontSize: 15 }}>
                          Analyzing & Summarizing Document...
                        </p>
                        <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
                          Extracting sections, structuring key findings, and building ChromaDB vector index.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Right Column: RAG Q&A Assistant */}
              {(activeTab === 'split' || activeTab === 'chat') && (
                <div style={{ 
                  flex: 1,
                  height: '100%', 
                  minHeight: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  background: 'rgba(5, 10, 18, 0.5)', 
                  overflow: 'hidden',
                  maxWidth: activeTab === 'chat' ? 1080 : '100%',
                  margin: activeTab === 'chat' ? '0 auto' : '0',
                  width: '100%'
                }}>
                  
                  {/* Chat Header & Language Switcher */}
                  <div style={{ 
                    padding: '12px 22px', 
                    borderBottom: '1px solid rgba(255,255,255,0.06)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: 'rgba(10, 22, 40, 0.35)',
                    flexShrink: 0
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MessageSquare size={16} color="#d4a843" />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Ask this Document</span>
                    </div>

                    {/* Language Selector & Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Language:</span>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
                          {[
                            { code: 'en', label: 'EN' },
                            { code: 'mr', label: 'मराठी' },
                            { code: 'hi', label: 'हिन्दी' },
                          ].map(lang => (
                            <button
                              key={lang.code}
                              type="button"
                              onClick={() => setChatLang(lang.code)}
                              style={{
                                border: 'none',
                                padding: '3px 9px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: chatLang === lang.code ? 700 : 500,
                                background: chatLang === lang.code ? 'linear-gradient(135deg, #d4a843, #e4bc5a)' : 'transparent',
                                color: chatLang === lang.code ? '#0a1628' : '#94a3b8',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              {lang.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {chatMessages.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearChat}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: '#94a3b8',
                            fontSize: 11,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          title="Clear chat history for this document"
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#fb7185'; e.currentTarget.style.borderColor = 'rgba(244,63,94,0.3)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                        >
                          <Trash2 size={12} /> Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages Container */}
                  <div 
                    ref={chatContainerRef}
                    style={{ 
                      flex: 1, 
                      minHeight: 0, 
                      overflowY: 'auto', 
                      overscrollBehavior: 'contain', 
                      padding: '20px 24px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 16 
                    }}
                  >
                    {chatMessages.length === 0 && (
                      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                        <div style={{ 
                          width: 48, height: 48, borderRadius: '50%', 
                          background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          color: '#f0d078', margin: '0 auto 14px' 
                        }}>
                          <HelpCircle size={24} />
                        </div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                          {isReady ? 'Ask any question about this document' : 'Vector search will activate once processing finishes'}
                        </p>
                        <p style={{ color: '#64748b', fontSize: 12.5, marginBottom: 20 }}>
                          ChromaDB Vector Retrieval + Groq AI in English, मराठी & हिन्दी
                        </p>

                        {/* Quick Prompt Suggestions */}
                        {isReady && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 650, margin: '0 auto' }}>
                            {SUGGESTED_PROMPTS.map((item, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handleChat(null as any, item.prompt)}
                                style={{
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  color: '#cbd5e1',
                                  padding: '8px 14px',
                                  borderRadius: 20,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(212,168,67,0.15)';
                                  e.currentTarget.style.borderColor = 'rgba(212,168,67,0.35)';
                                  e.currentTarget.style.color = '#f0d078';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                  e.currentTarget.style.color = '#cbd5e1';
                                }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chat messages with FormattedMessage Markdown renderer */}
                    {chatMessages.map((msg, i) => (
                      <FormattedMessage 
                        key={i}
                        content={msg.content}
                        role={msg.role}
                        sources={msg.sources}
                      />
                    ))}

                    {chatLoading && (
                      <div style={{ 
                        alignSelf: 'flex-start', 
                        background: 'rgba(255, 255, 255, 0.03)', 
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        padding: '12px 18px', 
                        borderRadius: 14, 
                        display: 'flex', 
                        gap: 10, 
                        alignItems: 'center', 
                        fontSize: 13, 
                        color: '#f0d078' 
                      }}>
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Retrieving vector chunks & generating answer in {chatLang === 'mr' ? 'मराठी' : chatLang === 'hi' ? 'हिन्दी' : 'English'}...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input Bar */}
                  <form onSubmit={(e) => handleChat(e)} style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', background: 'rgba(7, 13, 24, 0.6)', flexShrink: 0 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        className="input-field"
                        placeholder={
                          isReady 
                            ? `Ask about this document (${chatLang === 'mr' ? 'मराठीत विचारा' : chatLang === 'hi' ? 'हिंदी में पूछें' : 'in English'})...` 
                            : 'Chat active once processing is complete...'
                        }
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        disabled={!isReady || chatLoading}
                        style={{ height: 48, paddingRight: 56, fontSize: 13.5, borderRadius: 12, background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
                      />
                      <button 
                        type="submit" 
                        disabled={!isReady || !chatInput.trim() || chatLoading}
                        style={{ 
                          position: 'absolute', 
                          right: 8, 
                          width: 34, 
                          height: 34, 
                          borderRadius: 9, 
                          background: isReady && chatInput.trim() && !chatLoading ? 'linear-gradient(135deg, #d4a843, #e4bc5a)' : '#1e293b', 
                          border: 'none', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          cursor: isReady && chatInput.trim() && !chatLoading ? 'pointer' : 'default', 
                          color: isReady && chatInput.trim() && !chatLoading ? '#0a1628' : '#64748b',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowUploadModal(false); }}
        >
          <div className="glass-card animate-slide-up" style={{ width: 480, padding: 32, borderRadius: 18, border: '1px solid rgba(212,168,67,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f0d078', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileUp size={20} /> Upload Governance Document
              </h2>
              <button 
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                  Select File (PDF, DOCX, TXT)
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="input-field"
                  style={{ padding: '8px 12px' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                  Document Title / Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra CAG Audit Report 2018-19"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                  AI Summary & Analysis Language
                </label>
                <select
                  value={uploadLang}
                  onChange={(e) => setUploadLang(e.target.value)}
                  className="input-field"
                  style={{ cursor: 'pointer' }}
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code} style={{ background: '#0a1628', color: '#fff' }}>
                      {lang.native} ({lang.label})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn-secondary"
                  style={{ padding: '10px 18px', fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', fontSize: 13 }}
                >
                  {uploading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
                  {uploading ? 'Ingesting & Vectorizing...' : 'Start Ingestion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
