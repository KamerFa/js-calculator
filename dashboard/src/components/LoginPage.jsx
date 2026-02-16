import { useState } from 'react';
import { authLogin, authRegister } from '../db';
import { IconGrid } from './Icons';
import { useTranslation, availableLanguages } from '../i18n';

export default function LoginPage({ onAuth }) {
  const { t, language, setLanguage } = useTranslation();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data =
        mode === 'login'
          ? await authLogin(username, password)
          : await authRegister(username, password);
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <IconGrid />
            <span>{t('app.title')}</span>
          </div>
          <div className="language-switcher">
            {availableLanguages.map((lang) => (
              <button
                key={lang.code}
                className={`lang-btn ${language === lang.code ? 'active' : ''}`}
                onClick={() => setLanguage(lang.code)}
                title={lang.name}
              >
                {lang.flag}
              </button>
            ))}
          </div>
        </div>

        <h1>{mode === 'login' ? t('auth.login') : t('auth.register')}</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('auth.username')}</label>
            <input
              className="form-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.username')}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label>{t('auth.password')}</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password')}
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading
              ? t('common.loading')
              : mode === 'login'
                ? t('auth.loginButton')
                : t('auth.registerButton')}
          </button>
        </form>

        <div className="login-switch">
          {mode === 'login' ? (
            <>
              {t('auth.noAccount')}{' '}
              <button onClick={() => { setMode('register'); setError(''); }}>
                {t('auth.registerHere')}
              </button>
            </>
          ) : (
            <>
              {t('auth.alreadyHaveAccount')}{' '}
              <button onClick={() => { setMode('login'); setError(''); }}>
                {t('auth.loginHere')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
