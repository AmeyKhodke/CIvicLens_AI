'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  ChevronLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  Send, 
  BrainCircuit,
  Loader2,
  RefreshCw,
  FileText,
  Trash2,
  Copy,
  Check,
  Globe,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import ExecutiveSummaryView from '@/components/ExecutiveSummaryView';
import FormattedMessage from '@/components/FormattedMessage';

const statusIs = (docStatus: string, target: string) =>
  docStatus?.toLowerCase() === target.toLowerCase();

const isProcessing = (docStatus: string) =>
  ['uploaded', 'processing', 'pending'].includes(docStatus?.toLowerCase());

const isReady = (docStatus: string) => statusIs(docStatus, 'ready');
const isFailed = (docStatus: string) => statusIs(docStatus, 'failed');

const SUGGESTED_PROMPTS = [
  { label: '📊 Key Findings', prompt: 'Tell me the key findings and main summary points of this document.' },
  { label: '📄 Page Count & Info', prompt: 'No. of pages in the document and document metadata?' },
  { label: '💰 Budget & Financials', prompt: 'What are the key financial, budgetary, or revenue figures mentioned?' },
  { label: '⚠️ Audit / Issues', prompt: 'What are the main issues, misappropriations, or risks highlighted?' },
  { label: '✅ Action Items', prompt: 'What decisions, recommendations, or action items are proposed?' },
];

export default function DocumentDetail() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [chatLang, setChatLang] = useState('en');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDeleteDoc = async () => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    setDeleting(true);
    try {
      await api.deleteDocument(docId);
      localStorage.removeItem(`civiclens_doc_chat_${docId}`);
      router.push('/documents');
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
      setDeleting(false);
    }
  };

  const loadDoc = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/');
      return;
    }
    try {
      const data = await api.getDocument(docId);
      setDoc(data);
      if (data?.language) setChatLang(data.language);
      return data;
    } catch (e: any) {
      if (e?.status === 401) {
        router.push('/');
        return;
      }
      console.error('Failed to load document:', e);
    } finally {
      setLoading(false);
    }
  }, [docId, router]);

  const startPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const updated = await api.getDocument(docId);
        setDoc(updated);
        if (isReady(updated.status) || isFailed(updated.status)) {
          if (pollTimer.current) clearInterval(pollTimer.current);
        }
      } catch (e: any) {
        if (e?.status === 401) {
          router.push('/');
        }
      }
    }, 2500);
  }, [docId, router]);

  // Load chat history from localStorage for this specific document
  useEffect(() => {
    if (docId) {
      try {
        const saved = localStorage.getItem(`civiclens_doc_chat_${docId}`);
        if (saved) {
          setChatMessages(JSON.parse(saved));
        } else {
          setChatMessages([]);
        }
      } catch (e) {
        setChatMessages([]);
      }
    }
  }, [docId]);

  const updateMessagesAndStore = (newMsgs: any[]) => {
    setChatMessages(newMsgs);
    if (docId) {
      try {
        localStorage.setItem(`civiclens_doc_chat_${docId}`, JSON.stringify(newMsgs));
      } catch (e) {
        console.error('Failed to save document chat to localStorage:', e);
      }
    }
  };

  const handleClearChat = () => {
    if (chatMessages.length === 0) return;
    if (confirm('Clear chat conversation history for this document?')) {
      setChatMessages([]);
      localStorage.removeItem(`civiclens_doc_chat_${docId}`);
    }
  };

  useEffect(() => {
    loadDoc().then((data) => {
      if (data && isProcessing(data.status)) {
        startPolling();
      }
    });
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [docId, loadDoc, startPolling]);

  useEffect(() => {
    if (doc && isProcessing(doc.status)) {
      startPolling();
    }
  }, [doc?.status, doc, startPolling]);

  useEffect(() => {
    if (chatMessages.length > 0 || chatLoading) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, chatLoading]);

  const handleChat = async (e: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const query = customPrompt || chatInput;
    if (!query.trim() || chatLoading) return;

    setChatInput('');
    const userMsg = { role: 'user', content: query };
    const updatedWithUser = [...chatMessages, userMsg];
    updateMessagesAndStore(updatedWithUser);
    setChatLoading(true);

    try {
      const res = await api.chatWithDocument(docId, query, chatLang);
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
    if (!doc?.summary) return;
    navigator.clipboard.writeText(doc.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={36} style={{ color: '#f0d078', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8' }}>Loading document intelligence workspace...</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#fb7185', fontSize: 16 }}>Document not found or has been removed.</p>
        <button onClick={() => router.push('/documents')} className="btn-primary" style={{ marginTop: 16 }}>
          Back to Documents
        </button>
      </div>
    );
  }

  const docIsReady = isReady(doc.status);
  const docIsProcessing = isProcessing(doc.status);
  const docIsFailed = isFailed(doc.status);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #070d18 0%, #0a1628 100%)', color: '#f1f5f9' }}>
      
      {/* Top Header Bar */}
      <header style={{ 
        padding: '16px 32px', 
        borderBottom: '1px solid rgba(212, 168, 67, 0.12)',
        background: 'rgba(10, 22, 40, 0.7)',
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', gap: 16
      }}>
        <button onClick={() => router.push('/documents')} className="btn-icon" title="Back to documents">
          <ChevronLeft size={20} />
        </button>
        
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            {doc.title || doc.filename}
          </h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={13} /> {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {doc.page_count && (
              <span style={{ fontSize: 12, color: '#f0d078', fontWeight: 600 }}>
                📄 {doc.page_count} Pages
              </span>
            )}
            <span style={{ 
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: docIsReady ? 'rgba(16,185,129,0.15)' : docIsFailed ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)',
              color: docIsReady ? '#10b981' : docIsFailed ? '#f43f5e' : '#f59e0b',
              border: `1px solid ${docIsReady ? 'rgba(16,185,129,0.3)' : docIsFailed ? 'rgba(244,63,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
              display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.04em'
            }}>
              {docIsReady && <CheckCircle2 size={11} />}
              {docIsFailed && <AlertCircle size={11} />}
              {docIsProcessing && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
              {doc.status}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {docIsProcessing && (
            <button onClick={() => loadDoc()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <RefreshCw size={14} /> Refresh
            </button>
          )}
          {docIsReady && doc.summary && (
            <button onClick={handleCopySummary} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Summary'}
            </button>
          )}
          <button
            onClick={handleDeleteDoc}
            disabled={deleting}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fb7185', borderColor: 'rgba(244,63,94,0.25)' }}
          >
            {deleting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </header>

      {/* Content Split View */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', overflow: 'hidden' }}>
        
        {/* Left Column: AI Executive Summary & Metadata */}
        <div style={{ padding: 32, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          
          {/* Executive Summary Card */}
          <div style={{ marginBottom: 32 }}>
            {docIsReady && doc.summary ? (
              <ExecutiveSummaryView 
                summary={doc.summary}
                title={doc.title || doc.filename}
                language={doc.language}
                pageCount={doc.page_count}
                fileName={doc.filename}
              />
            ) : docIsReady && !doc.summary ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: 40, borderRadius: 14, background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8' }}>
                <BrainCircuit size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p>Summary not generated yet. This document has been indexed for chat.</p>
              </div>
            ) : docIsFailed ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: 40, borderRadius: 14, background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <AlertCircle size={32} color="#f43f5e" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#fb7185' }}>
                  {doc.summary?.includes('failed') ? doc.summary : 'Processing failed. Please try re-uploading.'}
                </p>
              </div>
            ) : (
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 16, borderRadius: 14, background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Loader2 size={32} style={{ color: '#f0d078', animation: 'spin 1s linear infinite' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#f0d078', fontWeight: 600, marginBottom: 4 }}>Generating AI Summary...</p>
                  <p style={{ color: '#64748b', fontSize: 13 }}>Extracting sections and vectorizing in ChromaDB.</p>
                </div>
              </div>
            )}
          </div>

          {/* Document Metadata Grid */}
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              Document Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'FILE NAME', value: doc.filename },
                { label: 'TOTAL PAGES', value: `${doc.page_count || 1} Pages` },
                { 
                  label: 'FILE SIZE', 
                  value: doc.file_size 
                    ? (doc.file_size > 1024 * 1024 
                        ? `${(doc.file_size / (1024 * 1024)).toFixed(2)} MB` 
                        : `${(doc.file_size / 1024).toFixed(1)} KB`) 
                    : '--' 
                },
                { label: 'FILE TYPE', value: doc.file_type?.toUpperCase() },
                { label: 'LANGUAGE', value: doc.language === 'mr' ? 'मराठी (Marathi)' : doc.language === 'hi' ? 'हिन्दी (Hindi)' : 'English' },
                { label: 'STATUS', value: doc.status?.toUpperCase() },
              ].map((item, i) => (
                <div key={i} className="glass-card" style={{ padding: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AI Chat Panel */}
        <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'rgba(5, 10, 18, 0.45)', overflow: 'hidden' }}>
          
          {/* Chat Header & Language Switcher */}
          <div style={{ 
            padding: '16px 24px', 
            borderBottom: '1px solid rgba(255,255,255,0.06)', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(10, 22, 40, 0.3)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MessageSquare size={17} color="#d4a843" />
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Ask this Document</h2>
            </div>

            {/* Language Switcher & Controls */}
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
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: chatLang === lang.code ? 700 : 500,
                        background: chatLang === lang.code ? '#d4a843' : 'transparent',
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
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                <div style={{ 
                  width: 44, height: 44, borderRadius: '50%', 
                  background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  color: '#f0d078', margin: '0 auto 12px' 
                }}>
                  <HelpCircle size={22} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                  {docIsReady ? 'Ask any question about this document' : 'Vector search will activate once processing finishes'}
                </p>
                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 20 }}>
                  ChromaDB Vector Retrieval + Groq AI in English, मराठी & हिन्दी
                </p>

                {/* Quick Prompts */}
                {docIsReady && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {SUGGESTED_PROMPTS.map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleChat(null as any, item.prompt)}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#cbd5e1',
                          padding: '6px 12px',
                          borderRadius: 16,
                          fontSize: 12,
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
                padding: '12px 16px', 
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
          <form onSubmit={(e) => handleChat(e)} style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', background: 'rgba(7, 13, 24, 0.5)' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                className="input-field"
                placeholder={
                  docIsReady 
                    ? `Ask about this document (${chatLang === 'mr' ? 'मराठीत विचारा' : chatLang === 'hi' ? 'हिंदी में पूछें' : 'in English'})...` 
                    : 'Chat active once processing is complete...'
                }
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={!docIsReady || chatLoading}
                style={{ height: 46, paddingRight: 52, fontSize: 13, borderRadius: 10, background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
              />
              <button 
                type="submit" 
                disabled={!docIsReady || !chatInput.trim() || chatLoading}
                style={{ 
                  position: 'absolute', 
                  right: 8, 
                  width: 32, 
                  height: 32, 
                  borderRadius: 8, 
                  background: docIsReady && chatInput.trim() && !chatLoading ? '#f0d078' : '#1e293b', 
                  border: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: docIsReady && chatInput.trim() && !chatLoading ? 'pointer' : 'default', 
                  color: docIsReady && chatInput.trim() && !chatLoading ? '#0a1628' : '#64748b',
                  transition: 'all 0.2s'
                }}
              >
                <Send size={15} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
