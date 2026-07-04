import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { BRANCHES, ROLES } from '../lib/constants';

const ease = [0.22, 1, 0.36, 1];

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
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        <motion.div
          className="login-brand"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease }}
        >
          <img src="/logo.jpeg" alt="BOUTIQUE" className="login-logo" />
          <div>
            <h1>BOUTIQUE</h1>
            <p>Filial sifariş idarəetməsi</p>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="login-form">
          <motion.div
            className="role-toggle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4, ease }}
          >
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
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            {role === ROLES.BRANCH ? (
              <motion.label
                key="branch"
                className="field"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease }}
              >
                <span>Filial</span>
                <select value={username} onChange={(e) => setUsername(e.target.value)}>
                  {BRANCHES.map((b) => (
                    <option key={b.username} value={b.username}>
                      {b.displayName}
                    </option>
                  ))}
                </select>
              </motion.label>
            ) : (
              <motion.label
                key="admin"
                className="field"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease }}
              >
                <span>İstifadəçi adı</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </motion.label>
            )}
          </AnimatePresence>

          <motion.label
            className="field"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4, ease }}
          >
            <span>Şifrə</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </motion.label>

          <AnimatePresence>
            {error && (
              <motion.div
                className="form-error"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2, ease }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            className="btn-primary"
            disabled={loading}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4, ease }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {loading ? 'Daxil olunur…' : 'Daxil ol'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
