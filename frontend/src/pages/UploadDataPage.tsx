import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadDataset, createProfile, listDatasets } from '../services/api';
import type { Dataset } from '../types';

export default function UploadDataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Profile fields
  const [profileName, setProfileName] = useState('Default Profile');
  const [segmentCol, setSegmentCol] = useState('');
  const [priceCol, setPriceCol] = useState('');
  const [demandCol, setDemandCol] = useState('');
  const [dateCol, setDateCol] = useState('');
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleUpload = async () => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const ds = await uploadDataset(file) as Dataset;
      setDataset(ds);
      // Auto-populate first column guesses
      if (ds.columns && ds.columns.length >= 3) {
        setSegmentCol(ds.columns[0]);
        setPriceCol(ds.columns[1]);
        setDemandCol(ds.columns[2]);
        if (ds.columns.length >= 4) setDateCol(ds.columns[3]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await createProfile({
        name: profileName,
        segment_column: segmentCol,
        price_column: priceCol,
        demand_column: demandCol,
        date_column: dateCol,
      });
      navigate('/build-twin', { state: { datasetId: dataset?.id } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Upload Your Data</h2>

        {!dataset ? (
          <>
            <p style={styles.subtitle}>
              Upload an Excel (.xlsx) or CSV file with your pricing and demand data.
            </p>
            <div
              style={styles.dropzone}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <p style={{ margin: 0 }}>{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
              ) : (
                <p style={{ margin: 0, color: '#888' }}>Click to select a file</p>
              )}
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              style={styles.button}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </>
        ) : (
          <>
            <div style={styles.success}>
              Uploaded: <strong>{dataset.filename}</strong> — {dataset.row_count} rows, {dataset.columns?.length} columns
            </div>
            <h3 style={{ marginTop: 24, marginBottom: 8 }}>Configure Column Mapping</h3>
            <p style={{ color: '#666', fontSize: 14, marginTop: 0 }}>
              Map your columns so the twin knows which data to use.
              Available: {dataset.columns?.join(', ')}
            </p>
            <form onSubmit={handleCreateProfile} style={styles.form}>
              <label style={styles.label}>
                Profile Name
                <input value={profileName} onChange={e => setProfileName(e.target.value)} required style={styles.input} />
              </label>
              <label style={styles.label}>
                Segment Column *
                <select value={segmentCol} onChange={e => setSegmentCol(e.target.value)} required style={styles.input}>
                  <option value="">Select...</option>
                  {dataset.columns?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label style={styles.label}>
                Price Column *
                <select value={priceCol} onChange={e => setPriceCol(e.target.value)} required style={styles.input}>
                  <option value="">Select...</option>
                  {dataset.columns?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label style={styles.label}>
                Demand Column *
                <select value={demandCol} onChange={e => setDemandCol(e.target.value)} required style={styles.input}>
                  <option value="">Select...</option>
                  {dataset.columns?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label style={styles.label}>
                Date Column (optional)
                <select value={dateCol} onChange={e => setDateCol(e.target.value)} style={styles.input}>
                  <option value="">None</option>
                  {dataset.columns?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              {error && <p style={styles.error}>{error}</p>}
              <button type="submit" disabled={saving} style={styles.button}>
                {saving ? 'Saving...' : 'Save Profile & Continue'}
              </button>
            </form>
          </>
        )}
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
  dropzone: {
    border: '2px dashed #ccc',
    borderRadius: 8,
    padding: '40px 20px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    marginBottom: 12,
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
    padding: '12px',
    border: 'none',
    borderRadius: 8,
    background: '#4361ee',
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
  success: {
    background: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: 8,
    padding: '12px 16px',
    color: '#155724',
  },
  error: { color: '#e63946', fontSize: 14, margin: 0 },
};
