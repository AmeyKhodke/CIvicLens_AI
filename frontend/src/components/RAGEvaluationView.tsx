'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, CheckCircle2, AlertCircle, RefreshCw, 
  Play, Download, Eye, Layers, 
  Clock, Cpu, Database, ShieldCheck, X, FileText,
  Activity, ArrowUpRight, Check, Sparkles
} from 'lucide-react';
import api from '@/lib/api';

interface RAGEvaluationViewProps {
  document: any;
  isReadOnly?: boolean;
}

const getScoreBadge = (val: number) => {
  if (val >= 0.85) return { label: 'Optimal', color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)' };
  if (val >= 0.70) return { label: 'Good', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.25)' };
  if (val >= 0.55) return { label: 'Moderate', color: '#f0d078', bg: 'rgba(240,208,120,0.12)', border: 'rgba(240,208,120,0.25)' };
  return { label: 'Needs Tuning', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' };
};

export default function RAGEvaluationView({ document, isReadOnly = false }: RAGEvaluationViewProps) {
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState<any>(null);

  useEffect(() => {
    if (document?.id) {
      loadEvaluation();
    }
  }, [document?.id]);

  const loadEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDocumentEvaluation(document.id);
      setEvaluation(data || null);
    } catch (err: any) {
      console.error('Failed to load evaluation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunEvaluation = async () => {
    if (isReadOnly) {
      alert('Public Leader (Read-Only) cannot run evaluations.');
      return;
    }
    setEvaluating(true);
    setError(null);
    try {
      const result = await api.evaluateDocument(document.id);
      setEvaluation(result);
    } catch (err: any) {
      console.error('Evaluation run failed:', err);
      setError(err.message || 'Evaluation could not be completed.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleExportReport = () => {
    if (!evaluation) return;
    const reportData = {
      platform: 'CivicLens AI Governance Platform',
      document_title: document.title || document.filename,
      document_id: document.id,
      evaluation_timestamp: evaluation.created_at,
      model_used: evaluation.model_name,
      embedding_model: evaluation.embedding_model,
      top_k: evaluation.top_k,
      average_retrieval_latency_ms: evaluation.avg_retrieval_time_ms,
      average_generation_latency_ms: evaluation.avg_generation_time_ms,
      ragas_metrics: {
        faithfulness: evaluation.metrics.faithfulness,
        answer_relevancy: evaluation.metrics.answer_relevancy,
        context_precision: evaluation.metrics.context_precision,
        context_recall: evaluation.metrics.context_recall,
      },
      overall_rag_quality_score: evaluation.overall_score,
      total_evaluation_questions: evaluation.total_questions,
      evaluated_dataset: evaluation.results
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `CivicLens_RAGAS_Report_${document.filename || document.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!document) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
        <p>Please select a document to inspect RAG evaluation metrics.</p>
      </div>
    );
  }

  const docTitle = document.title || document.filename;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px', background: 'rgba(7, 13, 24, 0.45)' }}>
      
      {/* ── Header Area ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(240,208,120,0.1)', border: '1px solid rgba(240,208,120,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078' }}>
              <Activity size={15} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.01em' }}>
              RAG Quality Benchmark
            </h2>
            <span style={{ 
              fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
              background: evaluating ? 'rgba(240,208,120,0.12)' : evaluation ? 'rgba(52,211,153,0.12)' : 'rgba(100,116,139,0.12)',
              color: evaluating ? '#f0d078' : evaluation ? '#34d399' : '#94a3b8',
              border: `1px solid ${evaluating ? 'rgba(240,208,120,0.25)' : evaluation ? 'rgba(52,211,153,0.25)' : 'rgba(100,116,139,0.2)'}`,
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}>
              {evaluating ? 'Evaluating...' : evaluation ? 'Completed' : 'Not Evaluated'}
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12.5, margin: '2px 0 0' }}>
            Quantitative governance evaluation measuring groundedness, precision, recall, and semantic relevancy.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11.5, color: '#64748b', marginTop: 6 }}>
            <span>Document: <strong style={{ color: '#cbd5e1' }}>{docTitle}</strong></span>
            {evaluation?.created_at && (
              <span>Last Benchmark: <strong style={{ color: '#94a3b8' }}>{new Date(evaluation.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {evaluation && (
            <button
              onClick={handleExportReport}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
              title="Export Report"
            >
              <Download size={13} /> Export JSON
            </button>
          )}

          {!isReadOnly && (
            <button
              onClick={handleRunEvaluation}
              disabled={evaluating}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px', fontWeight: 600 }}
            >
              {evaluating ? (
                <>
                  <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Evaluating...
                </>
              ) : evaluation ? (
                <>
                  <RefreshCw size={13} /> Re-run Benchmark
                </>
              ) : (
                <>
                  <Play size={13} fill="currentColor" /> Run Benchmark
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 12.5, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600 }}>Evaluation could not be completed.</div>
              <div style={{ fontSize: 11.5, opacity: 0.9 }}>{error}</div>
            </div>
          </div>
          {!isReadOnly && (
            <button onClick={handleRunEvaluation} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>
              Retry
            </button>
          )}
        </div>
      )}

      {/* ── Running / Progress Indicator ── */}
      {evaluating && (
        <div className="glass-card" style={{ padding: '32px 24px', textAlign: 'center', marginBottom: 20, borderRadius: 12, border: '1px solid rgba(240,208,120,0.2)', background: 'rgba(10,22,40,0.5)' }}>
          <RefreshCw size={28} color="#f0d078" style={{ animation: 'spin 1.2s linear infinite', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc', margin: '0 0 4px' }}>
            Benchmarking CivicLens RAG Pipeline
          </h3>
          <p style={{ color: '#94a3b8', fontSize: 12, maxWidth: 480, margin: '0 auto' }}>
            Executing Hybrid ChromaDB retrieval, running LLM grounded generation, and computing mathematical RAGAS parameters.
          </p>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !evaluation && !evaluating && !error && (
        <div className="glass-card" style={{ padding: '48px 32px', textAlign: 'center', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(10,22,40,0.3)', margin: '16px 0' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(240,208,120,0.08)', border: '1px solid rgba(240,208,120,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078', margin: '0 auto 14px' }}>
            <Activity size={20} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc', margin: '0 0 6px' }}>
            RAG evaluation has not been performed for this document
          </h3>
          <p style={{ color: '#94a3b8', fontSize: 12.5, maxWidth: 500, margin: '0 auto 20px', lineHeight: 1.5 }}>
            Run the automated RAGAS benchmark to assess retrieval accuracy, ground-truth alignment, context recall, and response faithfulness.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, maxWidth: 680, margin: '0 auto 24px', textAlign: 'left' }}>
            {[
              { label: 'Faithfulness', desc: 'Verifies responses are strictly grounded in document context.' },
              { label: 'Answer Relevancy', desc: 'Evaluates directness and semantic alignment with user queries.' },
              { label: 'Context Precision', desc: 'Measures signal-to-noise ratio in top retrieved vector chunks.' },
              { label: 'Context Recall', desc: 'Checks that all required ground-truth statements were captured.' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#f0d078', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.3 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          {!isReadOnly && (
            <button onClick={handleRunEvaluation} className="btn-primary" style={{ padding: '8px 22px', fontSize: 13, fontWeight: 600 }}>
              <Play size={14} fill="currentColor" style={{ marginRight: 6 }} /> Run Evaluation
            </button>
          )}
        </div>
      )}

      {/* ── Completed State (Sober & Professional Layout) ── */}
      {evaluation && !evaluating && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          {/* 4 Core Metric KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { 
                key: 'faithfulness', 
                title: 'Faithfulness', 
                val: evaluation.metrics.faithfulness, 
                desc: 'Anti-hallucination & factual ground truth support' 
              },
              { 
                key: 'answer_relevancy', 
                title: 'Answer Relevancy', 
                val: evaluation.metrics.answer_relevancy, 
                desc: 'Direct semantic alignment with query intent' 
              },
              { 
                key: 'context_precision', 
                title: 'Context Precision', 
                val: evaluation.metrics.context_precision, 
                desc: 'Ranked signal-to-noise ratio in retrieved chunks' 
              },
              { 
                key: 'context_recall', 
                title: 'Context Recall', 
                val: evaluation.metrics.context_recall, 
                desc: 'Ground-truth statement coverage in context' 
              },
            ].map((m) => {
              const badge = getScoreBadge(m.val);
              return (
                <div 
                  key={m.key} 
                  className="glass-card" 
                  style={{ 
                    padding: '16px 18px', 
                    borderRadius: 10, 
                    border: '1px solid rgba(255,255,255,0.07)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: 'rgba(10,22,40,0.5)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{m.title}</span>
                      <span style={{ 
                        fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                        background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`
                      }}>
                        {badge.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                        {(m.val * 100).toFixed(0)}%
                      </span>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                        ({m.val.toFixed(2)})
                      </span>
                    </div>

                    {/* Clean Mini Progress Bar */}
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', margin: '10px 0 8px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          width: `${Math.min(100, Math.max(0, m.val * 100))}%`,
                          background: badge.color,
                          borderRadius: 2
                        }} 
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.35 }}>
                    {m.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall Quality Summary Strip */}
          <div className="glass-card" style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,22,40,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(240,208,120,0.1)', border: '1px solid rgba(240,208,120,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Overall RAG Quality Score:</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: '#f8fafc' }}>
                    {(evaluation.overall_score * 100).toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 11.5, color: '#64748b' }}>
                    ({evaluation.overall_score.toFixed(2)} / 1.00)
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Arithmetic mean of Faithfulness, Answer Relevancy, Context Precision, and Context Recall.
                </div>
              </div>
            </div>

            {/* Benchmark Target Indicator */}
            <div style={{ width: 220, flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                <span>Target Baseline: 80%</span>
                <span style={{ fontWeight: 600, color: evaluation.overall_score >= 0.80 ? '#34d399' : '#f0d078' }}>
                  {(evaluation.overall_score * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${Math.min(100, Math.max(0, evaluation.overall_score * 100))}%`,
                    background: evaluation.overall_score >= 0.80 ? '#34d399' : '#f0d078',
                    borderRadius: 3,
                    transition: 'width 0.4s ease'
                  }} 
                />
              </div>
            </div>
          </div>

          {/* ── Two-Column Architecture Diagnosis & Comparison ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            
            {/* Left: Pipeline Diagnostics */}
            <div className="glass-card" style={{ padding: '16px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,22,40,0.5)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#cbd5e1', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} color="#38bdf8" /> Pipeline Architecture Diagnostics
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Retrieval Engine */}
                <div style={{ padding: '10px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#38bdf8' }}>1. Vector Retrieval (ChromaDB + Hybrid RRF)</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      Avg: {(((evaluation.metrics.context_precision + evaluation.metrics.context_recall) / 2) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                    <div style={{ color: '#94a3b8' }}>Precision: <strong style={{ color: '#f8fafc' }}>{(evaluation.metrics.context_precision * 100).toFixed(0)}%</strong></div>
                    <div style={{ color: '#94a3b8' }}>Recall: <strong style={{ color: '#f8fafc' }}>{(evaluation.metrics.context_recall * 100).toFixed(0)}%</strong></div>
                  </div>
                </div>

                {/* Generation Engine */}
                <div style={{ padding: '10px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#f0d078' }}>2. Response Engine (LLM Generation)</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      Avg: {(((evaluation.metrics.faithfulness + evaluation.metrics.answer_relevancy) / 2) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                    <div style={{ color: '#94a3b8' }}>Faithfulness: <strong style={{ color: '#f8fafc' }}>{(evaluation.metrics.faithfulness * 100).toFixed(0)}%</strong></div>
                    <div style={{ color: '#94a3b8' }}>Relevancy: <strong style={{ color: '#f8fafc' }}>{(evaluation.metrics.answer_relevancy * 100).toFixed(0)}%</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Clean Benchmark Comparison */}
            <div className="glass-card" style={{ padding: '16px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,22,40,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#cbd5e1' }}>Metric Comparison vs Target (80%)</span>
                  <span style={{ fontSize: 10.5, color: '#64748b' }}>Enterprise Target = 80%</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { name: 'Faithfulness', score: evaluation.metrics.faithfulness },
                    { name: 'Answer Relevancy', score: evaluation.metrics.answer_relevancy },
                    { name: 'Context Precision', score: evaluation.metrics.context_precision },
                    { name: 'Context Recall', score: evaluation.metrics.context_recall },
                  ].map((bar) => (
                    <div key={bar.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: '#94a3b8' }}>{bar.name}</span>
                        <span style={{ fontWeight: 600, color: bar.score >= 0.80 ? '#34d399' : '#f0d078' }}>
                          {(bar.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
                        {/* Target line at 80% */}
                        <div style={{ position: 'absolute', left: '80%', top: 0, bottom: 0, width: 1.5, background: 'rgba(255,255,255,0.25)', zIndex: 2 }} />
                        <div 
                          style={{ 
                            height: '100%', 
                            width: `${Math.min(100, Math.max(0, bar.score * 100))}%`,
                            background: bar.score >= 0.80 ? '#34d399' : '#38bdf8',
                            borderRadius: 3
                          }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 10, color: '#64748b', marginTop: 10 }}>
                Vertical line marks the 80% enterprise governance threshold.
              </div>
            </div>

          </div>

          {/* ── Execution Metadata Strip ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: '#64748b', flexWrap: 'wrap', gap: 8 }}>
            <span>LLM: <strong style={{ color: '#cbd5e1' }}>{evaluation.model_name}</strong></span>
            <span>Vector Store: <strong style={{ color: '#cbd5e1' }}>ChromaDB (k={evaluation.top_k})</strong></span>
            <span>Retrieval: <strong style={{ color: '#38bdf8' }}>{evaluation.avg_retrieval_time_ms} ms</strong></span>
            <span>Generation: <strong style={{ color: '#f0d078' }}>{evaluation.avg_generation_time_ms} ms</strong></span>
            <span>Benchmark: <strong style={{ color: '#34d399' }}>RAGAS v0.2 Protocol</strong></span>
          </div>

          {/* ── Evaluation Dataset Table ── */}
          <div className="glass-card" style={{ padding: '16px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,22,40,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
                  Evaluation Dataset & Ground Truth Validation
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                  Click any sample to inspect retrieved context chunks and generated response grounding.
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {evaluation.results?.length || 0} benchmark queries
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#64748b', fontSize: 10.5, textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px', width: 32 }}>#</th>
                    <th style={{ padding: '8px 10px' }}>Evaluation Query</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 90 }}>Faithfulness</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 90 }}>Relevancy</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 90 }}>Precision</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 90 }}>Recall</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 80 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluation.results?.map((sample: any, idx: number) => (
                    <tr 
                      key={idx}
                      onClick={() => setSelectedSample(sample)}
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px', color: '#64748b' }}>{sample.sample_index || idx + 1}</td>
                      <td style={{ padding: '10px', color: '#e2e8f0', fontWeight: 500, maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sample.question}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', color: sample.metrics?.faithfulness >= 0.8 ? '#34d399' : '#f0d078', fontWeight: 600 }}>
                        {(sample.metrics?.faithfulness * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', color: sample.metrics?.answer_relevancy >= 0.8 ? '#34d399' : '#f0d078', fontWeight: 600 }}>
                        {(sample.metrics?.answer_relevancy * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', color: sample.metrics?.context_precision >= 0.8 ? '#34d399' : '#38bdf8', fontWeight: 600 }}>
                        {(sample.metrics?.context_precision * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', color: sample.metrics?.context_recall >= 0.8 ? '#34d399' : '#38bdf8', fontWeight: 600 }}>
                        {(sample.metrics?.context_recall * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedSample(sample); }}
                          style={{
                            padding: '3px 8px', borderRadius: 4, fontSize: 10.5,
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#cbd5e1', cursor: 'pointer', fontWeight: 500
                          }}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ── Sample Inspection Modal ── */}
      {selectedSample && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div className="glass-card" style={{ width: 760, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', padding: 24, background: '#0b1329' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#f0d078', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Benchmark Query #{selectedSample.sample_index}
                </span>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc', margin: '3px 0 0' }}>
                  {selectedSample.question}
                </h3>
              </div>
              <button onClick={() => setSelectedSample(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Score Badges */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <div style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Faithfulness</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#34d399' }}>{(selectedSample.metrics?.faithfulness * 100).toFixed(0)}%</div>
                </div>
                <div style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Relevancy</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#34d399' }}>{(selectedSample.metrics?.answer_relevancy * 100).toFixed(0)}%</div>
                </div>
                <div style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Precision</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>{(selectedSample.metrics?.context_precision * 100).toFixed(0)}%</div>
                </div>
                <div style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Recall</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>{(selectedSample.metrics?.context_recall * 100).toFixed(0)}%</div>
                </div>
              </div>

              {/* Generated Answer */}
              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#f0d078', marginBottom: 4 }}>
                  Generated Answer (CivicLens Pipeline)
                </div>
                <div style={{ fontSize: 12.5, color: '#e2e8f0', lineHeight: 1.45 }}>
                  {selectedSample.generated_answer}
                </div>
              </div>

              {/* Ground Truth Reference */}
              {selectedSample.ground_truth && (
                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(52,211,153,0.03)', border: '1px solid rgba(52,211,153,0.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#34d399', marginBottom: 4 }}>
                    Ground-Truth Reference
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
                    {selectedSample.ground_truth}
                  </div>
                </div>
              )}

              {/* Retrieved Chunks */}
              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(56,189,248,0.03)', border: '1px solid rgba(56,189,248,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#38bdf8', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Retrieved Context Chunks ({selectedSample.retrieved_contexts?.length || 0})</span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Latency: {selectedSample.retrieval_time_ms} ms</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {selectedSample.retrieved_contexts?.map((chunk: string, cIdx: number) => (
                    <div key={cIdx} style={{ padding: 8, borderRadius: 6, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: '#94a3b8', lineHeight: 1.35 }}>
                      <span style={{ fontWeight: 600, color: '#38bdf8', display: 'block', marginBottom: 2 }}>Chunk #{cIdx + 1}:</span>
                      {chunk}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedSample(null)} className="btn-secondary" style={{ padding: '5px 14px', fontSize: 12 }}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
