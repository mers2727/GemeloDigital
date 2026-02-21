import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getLatestTwin, listScenarios, createScenario, listDatasets,
} from '../services/api';
import type { Analysis, Scenario, SegmentDetail, ScenarioAction, Dataset } from '../types';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noTwin, setNoTwin] = useState(false);

  // Scenario form
  const [scenarioName, setScenarioName] = useState('');
  const [actions, setActions] = useState<ScenarioAction[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [scenarioResult, setScenarioResult] = useState<Scenario | null>(null);

  // Expanded scenario
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [ds] = await Promise.all([listDatasets()]);
      setDatasets(ds as Dataset[]);
      try {
        const twin = await getLatestTwin() as Analysis;
        setAnalysis(twin);
        setNoTwin(false);
        // Initialize actions with all segments
        if (twin.summary?.segment_details) {
          setActions(
            twin.summary.segment_details
              .filter(s => !s.error)
              .map(s => ({ segment: s.segment, price_change: 0 }))
          );
        }
      } catch {
        setNoTwin(true);
      }
      const sc = await listScenarios() as Scenario[];
      setScenarios(sc);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleActionChange = (idx: number, value: number) => {
    const next = [...actions];
    next[idx] = { ...next[idx], price_change: value };
    setActions(next);
  };

  const handleSimulate = async () => {
    if (!analysis || !scenarioName.trim()) return;
    const nonZero = actions.filter(a => a.price_change !== 0);
    if (nonZero.length === 0) {
      setError('Set at least one non-zero price change');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await createScenario({
        name: scenarioName,
        analysis_id: analysis.id,
        actions: nonZero,
      }) as Scenario;
      setScenarioResult(result);
      setScenarios(prev => [result, ...prev]);
      setScenarioName('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={styles.center}><p>Loading dashboard...</p></div>;
  }

  // No data at all
  if (datasets.length === 0) {
    return (
      <div style={styles.center}>
        <div style={styles.emptyCard}>
          <h2>Welcome to GemeloDigital</h2>
          <p>You haven't uploaded any data yet. Start by uploading your pricing data.</p>
          <button style={styles.button} onClick={() => navigate('/upload')}>
            Upload Data
          </button>
        </div>
      </div>
    );
  }

  // Has data but no twin
  if (noTwin) {
    return (
      <div style={styles.center}>
        <div style={styles.emptyCard}>
          <h2>Data Uploaded</h2>
          <p>You have data but no twin analysis yet. Build your digital twin to start simulating decisions.</p>
          <button style={styles.button} onClick={() => navigate('/build-twin')}>
            Build Twin
          </button>
        </div>
      </div>
    );
  }

  const summary = analysis?.summary;
  const segmentDetails = summary?.segment_details || [];

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>GemeloDigital</h1>
          <span style={styles.headerSub}>
            {user?.full_name} | {user?.role}
          </span>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.linkBtn} onClick={() => navigate('/upload')}>Upload Data</button>
          <button style={styles.linkBtn} onClick={() => navigate('/build-twin')}>Build Twin</button>
          <button style={{ ...styles.linkBtn, color: '#e63946' }} onClick={logout}>Logout</button>
        </div>
      </header>

      <div style={styles.content}>
        {/* Analysis Summary */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Twin Analysis Summary</h2>
          <div style={styles.statsRow}>
            <div style={styles.stat}>
              <div style={styles.statValue}>{summary?.total_segments ?? '-'}</div>
              <div style={styles.statLabel}>Total Segments</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statValue}>{summary?.valid_segments ?? '-'}</div>
              <div style={styles.statLabel}>Valid Segments</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statValue}>
                {summary?.avg_elasticity != null ? summary.avg_elasticity.toFixed(3) : '-'}
              </div>
              <div style={styles.statLabel}>Avg Elasticity (beta)</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statValue}>
                {summary?.avg_r_squared != null ? summary.avg_r_squared.toFixed(3) : '-'}
              </div>
              <div style={styles.statLabel}>Avg R-squared</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statValue}>{summary?.method || '-'}</div>
              <div style={styles.statLabel}>Method</div>
            </div>
          </div>
        </section>

        {/* Segment Elasticity Table */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Segments & Elasticity</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Segment</th>
                  <th style={styles.th}>Beta</th>
                  <th style={styles.th}>CI 95%</th>
                  <th style={styles.th}>R-sq</th>
                  <th style={styles.th}>Base Price</th>
                  <th style={styles.th}>Base Demand</th>
                  <th style={styles.th}>Rev Change %</th>
                  <th style={styles.th}>Regime</th>
                </tr>
              </thead>
              <tbody>
                {segmentDetails.map((s: SegmentDetail) => (
                  <tr key={s.segment}>
                    <td style={styles.td}>{s.segment}</td>
                    {s.error ? (
                      <td colSpan={7} style={{ ...styles.td, color: '#e63946' }}>{s.error}</td>
                    ) : (
                      <>
                        <td style={styles.td}>{s.beta?.toFixed(3)}</td>
                        <td style={styles.td}>
                          [{s.ci_95?.[0]?.toFixed(3)}, {s.ci_95?.[1]?.toFixed(3)}]
                        </td>
                        <td style={styles.td}>{s.r_squared?.toFixed(3)}</td>
                        <td style={styles.td}>{s.baseline_price?.toFixed(2)}</td>
                        <td style={styles.td}>{s.baseline_demand?.toFixed(0)}</td>
                        <td style={styles.td}>
                          {s.revenue_change_pct != null ? `${(s.revenue_change_pct * 100).toFixed(1)}%` : '-'}
                        </td>
                        <td style={styles.td}>{s.regime_used}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Decision Simulator */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Decision Simulator</h2>
          <p style={{ color: '#666', marginTop: 0 }}>
            Create a scenario by setting price changes per segment. Uses stored model artifacts — no re-upload needed.
          </p>

          <div style={styles.form}>
            <label style={styles.label}>
              Scenario Name
              <input
                value={scenarioName}
                onChange={e => setScenarioName(e.target.value)}
                placeholder="e.g. Increase premium prices +5%"
                style={styles.input}
              />
            </label>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Segment</th>
                    <th style={styles.th}>Price Change (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a, idx) => (
                    <tr key={a.segment}>
                      <td style={styles.td}>{a.segment}</td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          step="0.01"
                          value={a.price_change}
                          onChange={e => handleActionChange(idx, parseFloat(e.target.value) || 0)}
                          style={{ ...styles.input, width: 120, margin: 0 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button
              onClick={handleSimulate}
              disabled={submitting || !scenarioName.trim()}
              style={styles.button}
            >
              {submitting ? 'Simulating...' : 'Run Simulation'}
            </button>
          </div>

          {/* Latest scenario result */}
          {scenarioResult && (
            <div style={styles.resultBox}>
              <h3 style={{ margin: '0 0 8px' }}>Result: {scenarioResult.name}</h3>
              <pre style={styles.pre}>{scenarioResult.explanation_text}</pre>
            </div>
          )}
        </section>

        {/* Scenario History */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Scenario History</h2>
          {scenarios.length === 0 ? (
            <p style={{ color: '#888' }}>No scenarios created yet.</p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Actions</th>
                    <th style={styles.th}>Created</th>
                    <th style={styles.th}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map(sc => (
                    <>
                      <tr key={sc.id}>
                        <td style={styles.td}>{sc.name}</td>
                        <td style={styles.td}>
                          {sc.action_json?.map(a =>
                            `${a.segment}: ${a.price_change > 0 ? '+' : ''}${(a.price_change * 100).toFixed(1)}%`
                          ).join(', ')}
                        </td>
                        <td style={styles.td}>{new Date(sc.created_at).toLocaleString()}</td>
                        <td style={styles.td}>
                          <button
                            style={styles.linkBtn}
                            onClick={() => setExpandedScenario(
                              expandedScenario === sc.id ? null : sc.id
                            )}
                          >
                            {expandedScenario === sc.id ? 'Hide' : 'Show'}
                          </button>
                        </td>
                      </tr>
                      {expandedScenario === sc.id && (
                        <tr key={sc.id + '-detail'}>
                          <td colSpan={4} style={styles.td}>
                            <pre style={styles.pre}>{sc.explanation_text}</pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f0f2f5' },
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f2f5',
  },
  emptyCard: {
    background: '#fff',
    borderRadius: 12,
    padding: '40px 32px',
    textAlign: 'center' as const,
    maxWidth: 400,
    boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
  },
  header: {
    background: '#1a1a2e',
    color: '#fff',
    padding: '16px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { margin: 0, fontSize: 22 },
  headerSub: { fontSize: 13, color: '#aaa' },
  headerActions: { display: 'flex', gap: 12 },
  content: { maxWidth: 1100, margin: '0 auto', padding: '24px 20px' },
  section: {
    background: '#fff',
    borderRadius: 12,
    padding: '24px 28px',
    marginBottom: 20,
    boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
  },
  sectionTitle: { margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: '#1a1a2e' },
  statsRow: { display: 'flex', gap: 16, flexWrap: 'wrap' as const },
  stat: {
    background: '#f8f9fa',
    borderRadius: 8,
    padding: '16px 20px',
    flex: '1 1 140px',
    textAlign: 'center' as const,
  },
  statValue: { fontSize: 22, fontWeight: 700, color: '#4361ee' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  tableWrapper: { overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: {
    textAlign: 'left' as const,
    padding: '10px 12px',
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 600,
    color: '#333',
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #f0f0f0',
  },
  form: { display: 'flex', flexDirection: 'column' as const, gap: 14 },
  label: { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: 14, fontWeight: 500, color: '#333' },
  input: {
    padding: '10px 14px',
    border: '1px solid #ddd',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
  },
  button: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: 8,
    background: '#4361ee',
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-start' as const,
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#4361ee',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    padding: 0,
  },
  resultBox: {
    marginTop: 16,
    background: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: 8,
    padding: '16px 20px',
  },
  pre: {
    background: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    fontSize: 13,
    whiteSpace: 'pre-wrap' as const,
    margin: 0,
    overflowX: 'auto' as const,
  },
  error: { color: '#e63946', fontSize: 14, margin: 0 },
};
