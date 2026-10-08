'use client';
import React from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';

interface FormattedMessageProps {
  content: string;
  role: 'user' | 'assistant';
  sources?: any[];
}

export default function FormattedMessage({ content, role, sources }: FormattedMessageProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to parse inline styles like **bold**, `code`, links
  const renderInline = (text: string) => {
    // Match bold **text** or *text* or `code`
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} style={{ color: '#f0d078', fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code 
            key={index} 
            style={{ 
              background: 'rgba(212, 168, 67, 0.15)', 
              color: '#f0d078', 
              padding: '2px 6px', 
              borderRadius: 4, 
              fontSize: '0.9em',
              fontFamily: 'monospace'
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  if (role === 'user') {
    return (
      <div style={{
        alignSelf: 'flex-end',
        maxWidth: '85%',
        padding: '12px 18px',
        borderRadius: '16px 16px 4px 16px',
        background: 'linear-gradient(135deg, rgba(212, 168, 67, 0.25) 0%, rgba(212, 168, 67, 0.1) 100%)',
        border: '1px solid rgba(212, 168, 67, 0.35)',
        color: '#f8fafc',
        fontSize: 14,
        lineHeight: 1.6,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
      }}>
        {content}
      </div>
    );
  }

  // Parse assistant response into structured blocks
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <div key={`list-${elements.length}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '6px 0 10px 0' }}>
          {currentList}
        </div>
      );
      currentList = [];
    }
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    // Headings (## or ### or **Heading:** alone on line)
    const headingMatch = trimmed.match(/^(?:#{1,4}\s+|\*\*)([^*#]+)(?:\*\*)?:?$/);
    if (trimmed.startsWith('#') || (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.includes(': '))) {
      flushList();
      const title = trimmed.replace(/^#{1,4}\s+/, '').replace(/^\*\*|\*\*$/g, '').replace(/:$/, '');
      elements.push(
        <div key={`head-${lineIdx}`} style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#f0d078',
          letterSpacing: '0.02em',
          marginTop: elements.length > 0 ? 12 : 2,
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <Sparkles size={13} color="#d4a843" />
          <span>{title}</span>
        </div>
      );
      return;
    }

    // Key-Value Line (e.g. * **Title:** CivicLens Report or **File Size:** 640 KB)
    const kvMatch = trimmed.match(/^(?:[\*\-\•]\s+)?\*\*([^*]+)\*\*:\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const val = kvMatch[2].trim();
      currentList.push(
        <div 
          key={`kv-${lineIdx}`} 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '8px 12px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: 13,
            gap: 12
          }}
        >
          <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>{key}</span>
          <span style={{ color: '#f1f5f9', fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{renderInline(val)}</span>
        </div>
      );
      return;
    }

    // Bullet points (* or - or •)
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const bulletText = trimmed.replace(/^[\*\-\•]\s+/, '');
      currentList.push(
        <div key={`bullet-${lineIdx}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingLeft: 2 }}>
          <span style={{ color: '#f0d078', fontSize: 13, lineHeight: 1.5, flexShrink: 0 }}>•</span>
          <div style={{ flex: 1, fontSize: 13.5, color: '#e2e8f0', lineHeight: 1.65 }}>
            {renderInline(bulletText)}
          </div>
        </div>
      );
      return;
    }

    // Numbered list (1. 2.)
    const numMatch = trimmed.match(/^(\d+\.)\s+(.+)$/);
    if (numMatch) {
      currentList.push(
        <div key={`num-${lineIdx}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingLeft: 2 }}>
          <span style={{ color: '#f0d078', fontSize: 12, fontWeight: 700, minWidth: 20, flexShrink: 0, lineHeight: 1.6 }}>
            {numMatch[1]}
          </span>
          <div style={{ flex: 1, fontSize: 13.5, color: '#e2e8f0', lineHeight: 1.65 }}>
            {renderInline(numMatch[2])}
          </div>
        </div>
      );
      return;
    }

    // Normal paragraph
    flushList();
    elements.push(
      <p key={`p-${lineIdx}`} style={{ margin: '4px 0 8px 0', fontSize: 13.5, color: '#e2e8f0', lineHeight: 1.7 }}>
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList();

  return (
    <div style={{
      alignSelf: 'flex-start',
      width: '100%',
      maxWidth: '96%',
      padding: '16px 20px',
      borderRadius: '16px 16px 16px 4px',
      background: 'rgba(15, 23, 42, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      position: 'relative'
    }}>
      {/* Top Bar inside message */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#f0d078', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <Sparkles size={12} /> CivicLens AI Assistant
        </div>
        <button
          onClick={handleCopy}
          title="Copy response"
          style={{
            background: 'transparent',
            border: 'none',
            color: copied ? '#10b981' : '#64748b',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.2s'
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Structured Content */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {elements}
      </div>
    </div>
  );
}
