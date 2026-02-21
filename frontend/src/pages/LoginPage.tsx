import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { login, signup } from '../services/api';
import type { AuthResponse } from '../types';

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res: AuthResponse;
      if (isSignup) {
        res = await signup(email, password, fullName) as AuthResponse;
      } else {
        res = await login(email, password) as AuthResponse;
      }
      setAuth(res.access_token);
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
        <h1 style={styles.title}>GemeloDigital</h1>
        <p style={styles.subtitle}>Pricing Elasticity Digital Twin</p>

        <div style={styles.tabs}>
          <button
            style={!isSignup ? styles.activeTab : styles.tab}
            onClick={() => setIsSignup(false)}
          >
            Log In
          </button>
          <button
            style={isSignup ? styles.activeTab : styles.tab}
            onClick={() => setIsSignup(true)}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {isSignup && (
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={styles.input}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={styles.input}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Log In'}
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
    width: 400,
    maxWidth: '90vw',
    boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: '#1a1a2e',
    textAlign: 'center' as const,
  },
  subtitle: {
    textAlign: 'center' as const,
    color: '#666',
    marginBottom: 24,
  },
  tabs: {
    display: 'flex',
    gap: 0,
    marginBottom: 20,
    borderBottom: '2px solid #e0e0e0',
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 15,
    color: '#888',
  },
  activeTab: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    borderBottom: '2px solid #4361ee',
    background: 'none',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
    color: '#4361ee',
    marginBottom: -2,
  },
  form: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
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
  error: {
    color: '#e63946',
    fontSize: 14,
    margin: 0,
  },
};
