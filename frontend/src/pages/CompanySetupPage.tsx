import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createCompany } from '../services/api';

export default function CompanySetupPage() {
  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createCompany(name, sector, country);
      await refreshUser();
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Set Up Your Company</h2>
        <p style={styles.subtitle}>
          Create your company to start building your digital twin.
        </p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Company Name *
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={styles.input}
              placeholder="Acme Corp"
            />
          </label>
          <label style={styles.label}>
            Sector
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              style={styles.input}
              placeholder="Retail, SaaS, Manufacturing..."
            />
          </label>
          <label style={styles.label}>
            Country
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={styles.input}
              placeholder="Spain"
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Creating...' : 'Create Company'}
          </button>
        </form>
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
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '40px 32px',
    width: 480,
    maxWidth: '90vw',
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
  error: { color: '#e63946', fontSize: 14, margin: 0 },
};
