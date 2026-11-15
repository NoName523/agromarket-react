import { useState } from 'react';
import { apiFetch } from '../api';
import { productSchema } from '../generated/schemas.js';

function AddProductForm({ onAdded, onAuthError }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setMessage('');
    setError('');
    setFieldErrors({});
    const parsed = productSchema.safeParse({
      ...fields,
      category: fields.category || null,
      unit: fields.unit || 'кг',
      image: fields.image || null,
    });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) =>
        [issue.path[0], issue.message])));
      return;
    }
    setBusy(true);
    try {
      const created = await apiFetch('/products', {
        method: 'POST',
        body: parsed.data,
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
        <input id="product-name" name="name" required
          aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'product-name-error' : undefined} />
        {fieldErrors.name && <p id="product-name-error" className="form-error" role="alert">{fieldErrors.name}</p>}
        <label htmlFor="product-price">Цена, тг</label>
        <input id="product-price" name="price" type="number" min="1" step="1" required
          aria-invalid={Boolean(fieldErrors.price)} aria-describedby={fieldErrors.price ? 'product-price-error' : undefined} />
        {fieldErrors.price && <p id="product-price-error" className="form-error" role="alert">{fieldErrors.price}</p>}
        <label htmlFor="product-category">Категория</label>
        <input id="product-category" name="category"
          aria-invalid={Boolean(fieldErrors.category)} aria-describedby={fieldErrors.category ? 'product-category-error' : undefined} />
        {fieldErrors.category && <p id="product-category-error" className="form-error" role="alert">{fieldErrors.category}</p>}
        <label htmlFor="product-unit">Единица измерения</label>
        <input id="product-unit" name="unit" defaultValue="кг" required
          aria-invalid={Boolean(fieldErrors.unit)} aria-describedby={fieldErrors.unit ? 'product-unit-error' : undefined} />
        {fieldErrors.unit && <p id="product-unit-error" className="form-error" role="alert">{fieldErrors.unit}</p>}
        <label htmlFor="product-image">URL изображения</label>
        <input id="product-image" name="image" type="url" placeholder="https://…"
          aria-invalid={Boolean(fieldErrors.image)} aria-describedby={fieldErrors.image ? 'product-image-error' : undefined} />
        {fieldErrors.image && <p id="product-image-error" className="form-error" role="alert">{fieldErrors.image}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button disabled={busy}>{busy ? 'Сохранение…' : 'Добавить товар'}</button>
      </form>
    </section>
  );
}

export default AddProductForm;
