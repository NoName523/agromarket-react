import { useState } from 'react';
import { apiFetch } from '../api';

function LoginForm({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await apiFetch(`/auth/${mode}`, {
        method: 'POST',
        token: null,
        body: mode === 'register' ? { name, email, password } : { email, password },
      });
      setPassword('');
      onAuthenticated(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function selectMode(nextMode) {
    setMode(nextMode);
    setError('');
    setPassword('');
  }

  return (
    <section id="auth" className="panel auth-panel" aria-labelledby="auth-title">
      <div className="section-heading">
        <h2 id="auth-title">{mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
        <div className="auth-tabs" role="group" aria-label="Режим авторизации">
          <button type="button" className={mode === 'login' ? 'active' : ''}
            onClick={() => selectMode('login')}>Вход</button>
          <button type="button" className={mode === 'register' ? 'active' : ''}
            onClick={() => selectMode('register')}>Регистрация</button>
        </div>
      </div>
      <form className="stack-form" onSubmit={handleSubmit}>
        {mode === 'register' && <>
          <label htmlFor="auth-name">Имя</label>
          <input id="auth-name" value={name} onChange={(event) => setName(event.target.value)}
            autoComplete="name" required />
        </>}
        <label htmlFor="auth-email">Email</label>
        <input id="auth-email" type="email" value={email}
          onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        <label htmlFor="auth-password">Пароль</label>
        <input id="auth-password" type="password" value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          minLength={mode === 'register' ? 8 : undefined} required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
      </form>
    </section>
  );
}

export default LoginForm;
