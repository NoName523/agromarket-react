import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

const STATUSES = ['new', 'processing', 'done', 'cancelled'];

function OrdersPanel({ refreshKey, onAuthError }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch('/orders').then((data) => {
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

  async function changeStatus(order, status) {
    if (status === order.status) return;
    setBusyId(order.id);
    setError('');
    setMessage('');
    try {
      const updated = await apiFetch(`/orders/${order.id}`, {
        method: 'PATCH', body: { status },
      });
      setOrders((items) => items.map((item) => item.id === updated.id ? updated : item));
      setMessage(`Статус заявки №${order.id} обновлён.`);
    } catch (err) {
      setError(err.message);
      onAuthError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel" aria-labelledby="all-orders-title">
      <h2 id="all-orders-title">Панель заявок</h2>
      {loading && <p>Загрузка…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {!loading && !error && orders.length === 0 && <p>Заявок пока нет.</p>}
      {orders.length > 0 && <div className="order-list">
        {orders.map((order) => <article key={order.id} className="order-row">
          <strong>Заявка №{order.id}</strong>
          <span>{order.name} · {order.email}</span>
          <span>{order.product_name || 'Без товара'} · {order.quantity} кг</span>
          <label htmlFor={`order-status-${order.id}`}>Статус</label>
          <select id={`order-status-${order.id}`} value={order.status}
            onChange={(event) => changeStatus(order, event.target.value)}
            disabled={busyId === order.id}>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </article>)}
      </div>}
    </section>
  );
}

export default OrdersPanel;
