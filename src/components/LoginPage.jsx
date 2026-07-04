import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { BRANCHES, ROLES } from '../lib/constants';

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

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
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="login-brand" custom={0} variants={itemVariants} initial="hidden" animate="visible">
          <img src="/logo.jpeg" alt="BOUTIQUE" className="login-logo" />
          <div>
            <h1>BOUTIQUE</h1>
            <p>Filial sifariş idarəetməsi</p>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="login-form">
          <motion.div
            className="role-toggle"
            custom={1}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.button
              type="button"
              className={role === ROLES.BRANCH ? 'active' : ''}
              onClick={() => setRole(ROLES.BRANCH)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Filial
            </motion.button>
            <motion.button
              type="button"
              className={role === ROLES.ADMIN ? 'active' : ''}
              onClick={() => setRole(ROLES.ADMIN)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Admin
            </motion.button>
          </motion.div>

          <AnimatePresence mode="wait">
            {role === ROLES.BRANCH ? (
              <motion.label
                key="branch"
                className="field"
                custom={2}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
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
                custom={2}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
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
            custom={3}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
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
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            className="btn-primary"
            disabled={loading}
            custom={4}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? 'Daxil olunur…' : 'Daxil ol'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
