'use client';
import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, User, Loader2, BrainCircuit, FileSearch, MessageCircle, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import FormattedMessage from '@/components/FormattedMessage';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  mode?: 'document' | 'general';
}

const SUGGESTION_PROMPTS = [
  "What are the key findings in the uploaded reports?",
  "Summarize the pending action items from all meetings.",
  "What decisions were taken in recent consultations?",
  "Identify any budget-related information in the documents."
];

// Detect if the question is conversational (greeting, general, etc.)
const isConversational = (q: string) => {
  const patterns = /^(hi|hello|hey|namaste|how are you|what is|who are you|what can you|help me|thanks|thank you|good morning|good evening)\b/i;
  return patterns.test(q.trim()) || q.trim().split(' ').length <= 3;
};

const generalAnswer = (question: string): string | null => {
  const q = question.toLowerCase().trim();
  if (/^(hi|hello|hey|namaste)/.test(q)) {
    return "Hello! I'm CivicLens AI, your governance intelligence assistant. I can answer questions based on your uploaded documents and meeting records. How can I help you today?";
  }
  if (/how are you/.test(q)) {
    return "I'm functioning well, thank you! I'm ready to assist you with governance insights. Would you like me to analyze one of your uploaded documents?";
  }
  if (/who are you|what are you/.test(q)) {
    return "I'm CivicLens AI — an intelligent governance assistant built to help public administrators analyze documents, extract key decisions, and search across all your official records instantly.";
  }
  if (/what can you|help/.test(q)) {
    return "I can:\n• Summarize uploaded governance documents (PDFs, Reports, Memos)\n• Answer questions about meeting transcripts\n• Find specific data, decisions, and action items across all records\n• Compare information across multiple documents\n\nTry asking: \"What are the key findings in my uploaded reports?\"";
  }
  if (/thank/.test(q)) {
    return "You're welcome! Feel free to ask anything else about your governance data.";
  }
  return null;
};

export default function AssistantPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('civiclens_orchestrator_chat');
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load orchestrator chat history:', e);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateMessagesAndStore = (newMsgs: Message[]) => {
    setMessages(newMsgs);
    try {
      localStorage.setItem('civiclens_orchestrator_chat', JSON.stringify(newMsgs));
    } catch (e) {
      console.error('Failed to save orchestrator chat to localStorage:', e);
    }
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;
    if (confirm('Clear chat conversation history for the AI Assistant?')) {
      setMessages([]);
      localStorage.removeItem('civiclens_orchestrator_chat');
    }
  };

  const handleSend = async (question: string) => {
    const q = question || input;
    if (!q.trim() || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: q };
    const updatedWithUser = [...messages, userMsg];
    updateMessagesAndStore(updatedWithUser);
    setLoading(true);

    // Check for general conversational queries first
    const localAnswer = generalAnswer(q);
    if (localAnswer) {
      setTimeout(() => {
        const assistantMsg: Message = { role: 'assistant', content: localAnswer, mode: 'general' };
        updateMessagesAndStore([...updatedWithUser, assistantMsg]);
        setLoading(false);
      }, 500);
      return;
    }

    // Otherwise go to document RAG
    try {
      const res = await api.globalAssistantChat(q);
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
        mode: 'document'
      };
      updateMessagesAndStore([...updatedWithUser, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        role: 'assistant',
        content: `I encountered an error: ${err.message}. Please ensure you have uploaded and processed some documents first.`,
        mode: 'general'
      };
      updateMessagesAndStore([...updatedWithUser, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a1628' }}>
      {/* Header */}
      <div style={{ padding: '18px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(11,29,53,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(212,168,67,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078' }}>
            <Bot size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>CivicLens AI Assistant</h1>
            <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Powered by document intelligence & meeting analysis</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)' }}
            title="Clear Chat History"
          >
            <Trash2 size={13} />
            Clear Chat
          </button>
        )}
      </div>

      {/* Chat body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', gap: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(212,168,67,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078' }}>
              <Sparkles size={36} />
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>Hello! How can I help you?</h2>
              <p style={{ color: '#64748b', fontSize: 14, maxWidth: 440, lineHeight: 1.6 }}>
                I can answer general questions, summarize your documents, or find specific information across all uploaded governance records.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8, maxWidth: 640 }}>
              {SUGGESTION_PROMPTS.map((hint, i) => (
                <button key={i} onClick={() => handleSend(hint)}
                  style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#94a3b8', fontSize: 13, textAlign: 'left', cursor: 'pointer', lineHeight: 1.4, transition: 'all 0.2s' }}
                  onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,168,67,0.3)'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 12, alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', width: '100%', maxWidth: msg.role === 'user' ? '80%' : '860px', margin: msg.role === 'assistant' ? '0 auto' : undefined }}>
            <FormattedMessage 
              content={msg.content}
              role={msg.role}
              sources={msg.sources}
            />
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 12, alignSelf: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212,168,67,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078' }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div style={{ padding: '12px 18px', borderRadius: '18px 18px 18px 4px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BrainCircuit size={16} /> Searching documents...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: '20px 32px 36px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(11,29,53,0.2)' }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: 860, margin: '0 auto', position: 'relative' }}>
          <input
            className="input-field"
            placeholder="Ask anything — documents, meetings, or just say hello..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            style={{ height: 56, padding: '0 60px 0 22px', fontSize: 15, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <button type="submit" disabled={!input.trim() || loading}
            style={{ position: 'absolute', right: 10, top: 10, width: 36, height: 36, borderRadius: 10, background: input.trim() ? '#f0d078' : '#334155', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', color: '#0a1628', transition: 'all 0.2s' }}>
            <Send size={16} />
          </button>
        </form>
        <p style={{ textAlign: 'center', color: '#475569', fontSize: 11, marginTop: 10 }}>
          CivicLens AI · Responses grounded in your governance records
        </p>
      </div>
    </div>
  );
}
