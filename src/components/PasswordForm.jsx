import { useState } from 'react';
import { apiFetch } from '../api';

function PasswordForm({ onAuthError }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { oldPassword, newPassword } = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await apiFetch('/auth/password', {
        method: 'PATCH', body: { oldPassword, newPassword },
      });
      form.reset();
      setMessage(result.message);
    } catch (err) {
      setError(err.message);
      if (!(err.status === 401 && err.message === 'Неверный старый пароль')) onAuthError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="password-title">
      <h2 id="password-title">Смена пароля</h2>
      <form className="stack-form" onSubmit={handleSubmit}>
        <label htmlFor="old-password">Текущий пароль</label>
        <input id="old-password" name="oldPassword" type="password" autoComplete="current-password" required />
        <label htmlFor="new-password">Новый пароль</label>
        <input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength="8" required />
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button disabled={busy}>{busy ? 'Сохранение…' : 'Сменить пароль'}</button>
      </form>
    </section>
  );
}

export default PasswordForm;
