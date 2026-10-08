'use client';
import React, { useState } from 'react';
import { 
  Sparkles, Copy, Check, FileText, Download, 
  ChevronRight, Bookmark, ArrowUpRight, Globe
} from 'lucide-react';

interface ExecutiveSummaryViewProps {
  summary: string;
  title?: string;
  language?: string;
  pageCount?: number;
  fileName?: string;
}

export default function ExecutiveSummaryView({
  summary,
  title,
  language = 'en',
  pageCount,
  fileName,
}: ExecutiveSummaryViewProps) {
  const [copied, setCopied] = useState(false);

  if (!summary || !summary.trim()) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        <p>No summary content available.</p>
      </div>
    );
  }

  const wordCount = summary.trim().split(/\s+/).length;
  const readTimeMinutes = Math.max(1, Math.round(wordCount / 180));

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([summary], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(title || fileName || 'Executive_Summary').replace(/\s+/g, '_')}_Summary.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to parse bold text **text** into <strong>
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} style={{ color: '#f0d078', fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  // Parse summary into sections by ## headers
  const parseSections = (rawText: string) => {
    // Remove main # Executive Summary title if present at start
    const cleanText = rawText.replace(/^#\s+[^\n]+\n+/, '').trim();
    
    // Split by ## or numbered headers
    const rawSections = cleanText.split(/\n(?=##\s+)/);
    
    if (rawSections.length === 1 && !cleanText.startsWith('##')) {
      // Single block without ## headers
      return [{
        heading: 'Executive Overview',
        icon: '📌',
        paragraphs: cleanText.split(/\n\n+/).filter(Boolean)
      }];
    }

    return rawSections.map(sec => {
      const lines = sec.trim().split('\n');
      const firstLine = lines[0].replace(/^##\s+/, '').trim();
      const contentLines = lines.slice(1).join('\n').trim();
      
      let icon = '📌';
      if (firstLine.includes('Findings') || firstLine.includes('निरीक्षणे') || firstLine.includes('निष्कर्ष') || firstLine.includes('Findings')) icon = '🔍';
      else if (firstLine.includes('Financial') || firstLine.includes('Budget') || firstLine.includes('आर्थिक') || firstLine.includes('खर्च')) icon = '💰';
      else if (firstLine.includes('Action') || firstLine.includes('Decision') || firstLine.includes('निर्णय') || firstLine.includes('कृती')) icon = '⚡';
      else if (firstLine.includes('Recommendation') || firstLine.includes('शिफारसी')) icon = '✅';

      return {
        heading: firstLine,
        icon,
        paragraphs: contentLines.split(/\n\n+/).filter(Boolean)
      };
    });
  };

  const sections = parseSections(summary);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      
      {/* Top Action & Metadata Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 18px',
        background: 'linear-gradient(135deg, rgba(212, 168, 67, 0.12) 0%, rgba(212, 168, 67, 0.03) 100%)',
        border: '1px solid rgba(212, 168, 67, 0.25)',
        borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ 
            fontSize: 12, fontWeight: 700, color: '#f0d078', 
            display: 'flex', alignItems: 'center', gap: 6 
          }}>
            <Sparkles size={15} /> Executive Summary
          </span>
          <span style={{ color: '#475569', fontSize: 12 }}>•</span>
          <span style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6 }}>
            ⚡ ~{readTimeMinutes} min read ({wordCount} words)
          </span>
          {pageCount && (
            <span style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6 }}>
              📄 {pageCount} Pages Ingested
            </span>
          )}
          {language && (
            <span style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
              🌐 {language}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleCopy}
            title="Copy formatted summary"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: copied ? '#10b981' : '#cbd5e1',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          
          <button
            onClick={handleDownload}
            title="Download summary as Markdown"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Structured Section Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sections.map((sec, secIdx) => (
          <div
            key={secIdx}
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: 14,
              padding: '18px 22px',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Section Heading */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
              paddingBottom: 8,
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <span style={{ fontSize: 16 }}>{sec.icon}</span>
              <h3 style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#f0d078',
                letterSpacing: '-0.01em',
                margin: 0,
                textTransform: 'uppercase',
              }}>
                {sec.heading.replace(/^[📌🔍💰⚡✅\d\.\s]+/, '') || sec.heading}
              </h3>
            </div>

            {/* Section Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sec.paragraphs.map((para, pIdx) => {
                const lines = para.split('\n');
                
                return (
                  <div key={pIdx} style={{ fontSize: 13.5, color: '#e2e8f0', lineHeight: 1.75 }}>
                    {lines.map((line, lIdx) => {
                      const trimmed = line.trim();
                      if (!trimmed) return null;

                      // Bullet point rendering (* or -)
                      if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                        const bulletText = trimmed.replace(/^[\*\-\•]\s+/, '');
                        return (
                          <div 
                            key={lIdx} 
                            style={{ 
                              display: 'flex', 
                              gap: 10, 
                              alignItems: 'flex-start',
                              margin: '5px 0',
                              paddingLeft: 4 
                            }}
                          >
                            <span style={{ color: '#f0d078', fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>•</span>
                            <div style={{ flex: 1 }}>{renderFormattedText(bulletText)}</div>
                          </div>
                        );
                      }

                      // Numbered lists (1. 2.)
                      const numMatch = trimmed.match(/^(\d+\.)\s+(.+)$/);
                      if (numMatch) {
                        return (
                          <div 
                            key={lIdx} 
                            style={{ 
                              display: 'flex', 
                              gap: 10, 
                              alignItems: 'flex-start',
                              margin: '5px 0',
                              paddingLeft: 4 
                            }}
                          >
                            <span style={{ color: '#f0d078', fontSize: 12, fontWeight: 700, lineHeight: 1.6, flexShrink: 0, minWidth: 18 }}>
                              {numMatch[1]}
                            </span>
                            <div style={{ flex: 1 }}>{renderFormattedText(numMatch[2])}</div>
                          </div>
                        );
                      }

                      // Normal paragraph line
                      return (
                        <p key={lIdx} style={{ margin: '4px 0', lineHeight: 1.75 }}>
                          {renderFormattedText(trimmed)}
                        </p>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
