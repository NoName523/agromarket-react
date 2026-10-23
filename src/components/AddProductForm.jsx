import { useState } from 'react';
import { apiFetch } from '../api';

function AddProductForm({ onAdded, onAuthError }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const created = await apiFetch('/products', {
        method: 'POST',
        body: {
          name: fields.name,
          price: Number(fields.price),
          category: fields.category || null,
          unit: fields.unit || 'кг',
          image: fields.image || null,
        },
      });
      setMessage(`Товар «${created.name}» добавлен.`);
      form.reset();
      await onAdded();
    } catch (err) {
      setError(err.message);
      onAuthError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="add-product-title">
      <h2 id="add-product-title">Добавить товар</h2>
      <form className="stack-form" onSubmit={handleSubmit}>
        <label htmlFor="product-name">Название</label>
        <input id="product-name" name="name" required />
        <label htmlFor="product-price">Цена, тг</label>
        <input id="product-price" name="price" type="number" min="0" step="1" required />
        <label htmlFor="product-category">Категория</label>
        <input id="product-category" name="category" />
        <label htmlFor="product-unit">Единица измерения</label>
        <input id="product-unit" name="unit" defaultValue="кг" required />
        <label htmlFor="product-image">URL изображения</label>
        <input id="product-image" name="image" type="url" placeholder="https://…" />
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button disabled={busy}>{busy ? 'Сохранение…' : 'Добавить товар'}</button>
      </form>
    </section>
  );
}

export default AddProductForm;
