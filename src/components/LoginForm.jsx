import { useState } from 'react';
import { apiFetch } from '../api';
import { loginSchema, registerSchema } from '../generated/schemas.js';

function LoginForm({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    const schema = mode === 'register' ? registerSchema : loginSchema;
    const parsed = schema.safeParse(mode === 'register' ? { name, email, password } : { email, password });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) =>
        [issue.path[0], issue.message])));
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch(`/auth/${mode}`, {
        method: 'POST',
        token: null,
        body: parsed.data,
      });
      setPassword('');
      onAuthenticated(result);
    } catch (err) {
      setError(err.message);
      if (err.status === 400 && Array.isArray(err.details)) {
        setFieldErrors(Object.fromEntries(err.details
          .filter((detail) => detail && ['name', 'email', 'password'].includes(detail.field) && typeof detail.message === 'string')
          .map(({ field, message }) => [field, message])));
      }
    } finally {
      setBusy(false);
    }
  }

  function selectMode(nextMode) {
    setMode(nextMode);
    setError('');
    setFieldErrors({});
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
            aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'auth-name-error' : undefined}
            autoComplete="name" required />
          {fieldErrors.name && <p id="auth-name-error" className="form-error" role="alert">{fieldErrors.name}</p>}
        </>}
        <label htmlFor="auth-email">Email</label>
        <input id="auth-email" type="email" value={email}
          aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
          onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        {fieldErrors.email && <p id="auth-email-error" className="form-error" role="alert">{fieldErrors.email}</p>}
        <label htmlFor="auth-password">Пароль</label>
        <input id="auth-password" type="password" value={password}
          aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          minLength={mode === 'register' ? 8 : undefined} required />
        {fieldErrors.password && <p id="auth-password-error" className="form-error" role="alert">{fieldErrors.password}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
      </form>
    </section>
  );
}

export default LoginForm;
