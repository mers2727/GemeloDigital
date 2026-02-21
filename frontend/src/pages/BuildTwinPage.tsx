import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { listDatasets, listProfiles, buildTwin } from '../services/api';
import type { Dataset, BusinessProfile, Analysis } from '../types';

export default function BuildTwinPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [datasetId, setDatasetId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [method, setMethod] = useState('ols');
  const [priceChange, setPriceChange] = useState(0.05);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const [ds, pr] = await Promise.all([listDatasets(), listProfiles()]);
        setDatasets(ds as Dataset[]);
        setProfiles(pr as BusinessProfile[]);
        // Pre-select from navigation state
        const state = location.state as { datasetId?: string } | null;
        if (state?.datasetId) setDatasetId(state.datasetId);
        if ((ds as Dataset[]).length > 0 && !state?.datasetId) setDatasetId((ds as Dataset[])[0].id);
        if ((pr as BusinessProfile[]).length > 0) setProfileId((pr as BusinessProfile[])[0].id);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    })();
  }, []);

  const handleBuild = async () => {
    if (!datasetId || !profileId) {
      setError('Select a dataset and profile');
      return;
    }
    setError('');
    setBuilding(true);
    setProgress('Running regime detection, estimation, bootstrap, and walk-forward validation...');
    try {
      const result = await buildTwin(datasetId, profileId, method, priceChange) as Analysis;
      setProgress('Twin built successfully!');
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Build failed');
      setProgress('');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Build Your Digital Twin</h2>
        <p style={styles.subtitle}>
          Select a dataset and column profile to run the elasticity analysis.
        </p>

        {datasets.length === 0 && !error && (
          <div style={styles.warning}>
            No datasets uploaded yet. <a href="/upload">Upload data first</a>.
          </div>
        )}

        <div style={styles.form}>
          <label style={styles.label}>
            Dataset
            <select value={datasetId} onChange={e => setDatasetId(e.target.value)} style={styles.input}>
              <option value="">Select...</option>
              {datasets.map(d => (
                <option key={d.id} value={d.id}>{d.filename} ({d.row_count} rows)</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Column Profile
            <select value={profileId} onChange={e => setProfileId(e.target.value)} style={styles.input}>
              <option value="">Select...</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (seg={p.segment_column}, price={p.price_column}, demand={p.demand_column})
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Method
            <select value={method} onChange={e => setMethod(e.target.value)} style={styles.input}>
              <option value="ols">OLS (Ordinary Least Squares)</option>
              <option value="bayes">Bayesian (Normal prior on beta)</option>
            </select>
          </label>

          <label style={styles.label}>
            Default Price Change (for simulation)
            <input
              type="number"
              step="0.01"
              value={priceChange}
              onChange={e => setPriceChange(parseFloat(e.target.value) || 0)}
              style={styles.input}
            />
          </label>

          {progress && <div style={styles.progress}>{progress}</div>}
          {error && <p style={styles.error}>{error}</p>}

          <button
            onClick={handleBuild}
            disabled={building || !datasetId || !profileId}
            style={styles.button}
          >
            {building ? 'Building Twin...' : 'Build Twin'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f2f5',
    padding: 20,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '40px 32px',
    width: 540,
    maxWidth: '95vw',
    boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
  },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#1a1a2e' },
  subtitle: { color: '#666', marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
  label: { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: 14, fontWeight: 500, color: '#333' },
  input: {
    padding: '10px 14px',
    border: '1px solid #ddd',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
  },
  button: {
    padding: '12px',
    border: 'none',
    borderRadius: 8,
    background: '#4361ee',
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  },
  progress: {
    background: '#cce5ff',
    border: '1px solid #b8daff',
    borderRadius: 8,
    padding: '12px 16px',
    color: '#004085',
  },
  warning: {
    background: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: 8,
    padding: '12px 16px',
    color: '#856404',
    marginBottom: 16,
  },
  error: { color: '#e63946', fontSize: 14, margin: 0 },
};
