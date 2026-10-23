import { useState } from 'react';
import { apiFetch } from '../api';

function ContactForm({ products, productsLoading, onCreated, onAuthError }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = Object.fromEntries(new FormData(form));
    const data = {
      ...formData,
      product_id: formData.product_id ? Number(formData.product_id) : null,
    };

    try {
      setSending(true);
      setError('');
      const result = await apiFetch('/orders', { method: 'POST', body: data });
      alert(`Заявка №${result.id} принята!`);
      form.reset();
      onCreated();
    } catch (err) {
      setError(err.message);
      onAuthError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="contact" className="contact">
      <h2>Оптовая заявка</h2>
      <form className="contact-form" onSubmit={handleSubmit}>
        <label htmlFor="product_id">Выберите товар</label>
        <select id="product_id" name="product_id" defaultValue="">
          <option value="">Не выбран</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        {productsLoading && <p className="status-message">Загрузка товаров...</p>}
        {error && <p className="form-error" role="alert">{error}</p>}

        <label htmlFor="name">Имя / организация</label>
        <input id="name" name="name" type="text" required />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="farmer@mail.kz"
        />

        <label htmlFor="phone">Телефон</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+7 7XX XXX XX XX"
        />

        <label htmlFor="amount">Объём заказа, кг</label>
        <input
          id="amount"
          name="quantity"
          type="number"
          min="10"
          required
        />

        <label htmlFor="date">Желаемая дата доставки</label>
        <input
          id="date"
          name="date"
          type="date"
        />

        <label htmlFor="comment">Комментарий</label>
        <textarea
          id="comment"
          name="comment"
          rows="4"
        />

        <button type="submit" disabled={sending}>
          {sending ? 'Отправка…' : 'Отправить заявку'}
        </button>
      </form>
    </section>
  );
}

export default ContactForm;
