import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

function MyOrders({ refreshKey, onAuthError }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch('/orders/my').then((data) => {
      if (active) setOrders(data);
    }).catch((err) => {
      if (active) {
        setError(err.message);
        onAuthError(err);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [refreshKey, onAuthError]);

  return (
    <section className="panel" aria-labelledby="my-orders-title">
      <h2 id="my-orders-title">Мои заявки</h2>
      {loading && <p>Загрузка…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !error && orders.length === 0 && <p>Пока нет заявок, созданных под вашим аккаунтом.</p>}
      {!loading && !error && orders.length > 0 && (
        <div className="order-list">
          {orders.map((order) => <article key={order.id} className="order-row">
            <strong>Заявка №{order.id}</strong>
            <span>{order.product_name || 'Без выбранного товара'}</span>
            <span>Количество: {order.quantity} кг</span>
            <span>Статус: {order.status}</span>
          </article>)}
        </div>
      )}
    </section>
  );
}

export default MyOrders;
