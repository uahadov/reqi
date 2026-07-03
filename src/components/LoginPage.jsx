import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BRANCHES, ROLES } from '../lib/constants';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();

  const [role, setRole] = useState(ROLES.BRANCH);
  const [username, setUsername] = useState(BRANCHES[0].username);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(user.role === ROLES.ADMIN ? '/admin' : '/branch', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    setUsername(role === ROLES.ADMIN ? 'admin' : BRANCHES[0].username);
    setError('');
  }, [role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError('Zəhmət olmasa şifrə daxil edin.');
      return;
    }
    setLoading(true);
    try {
      const loggedInUser = await login({ role, username, password });
      navigate(loggedInUser.role === ROLES.ADMIN ? '/admin' : '/branch', { replace: true });
    } catch (err) {
      setError(err?.message || 'Yanlış məlumat. Zəhmət olmasa yenidən cəhd edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.jpeg" alt="BOUTIQUE" className="login-logo" />
          <div>
            <h1>BOUTIQUE</h1>
            <p>Filial sifariş idarəetməsi</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="role-toggle">
            <button
              type="button"
              className={role === ROLES.BRANCH ? 'active' : ''}
              onClick={() => setRole(ROLES.BRANCH)}
            >
              Filial
            </button>
            <button
              type="button"
              className={role === ROLES.ADMIN ? 'active' : ''}
              onClick={() => setRole(ROLES.ADMIN)}
            >
              Admin
            </button>
          </div>

          {role === ROLES.BRANCH ? (
            <label className="field">
              <span>Filial</span>
              <select value={username} onChange={(e) => setUsername(e.target.value)}>
                {BRANCHES.map((b) => (
                  <option key={b.username} value={b.username}>
                    {b.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>İstifadəçi adı</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>
          )}

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Daxil olunur…' : 'Daxil ol'}
          </button>
        </form>
      </div>
    </div>
  );
}
