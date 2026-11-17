import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function ProductPage({ id }) {
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    apiFetch(`/products/${id}`, { token: null }).then((data) => {
      if (!data || typeof data.name !== 'string') throw new Error('Сервер вернул некорректный товар');
      if (active) setProduct(data);
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [id]);

  return <main className="page">
    <section className="panel">
      <a href="/#catalog">Вернуться в каталог</a>
      {error ? <p role="alert">{error}</p> : product ? <>
        <h1>{product.name}</h1>
        {product.image && <img src={product.image} alt={product.name} />}
        <p>{product.price} тг</p>
      </> : <p role="status">Загрузка товара…</p>}
    </section>
  </main>;
}
