import { useState, useEffect, useCallback } from 'react';
import { apiFetch, TOKEN_KEY } from './api';
import ProductCard from './components/ProductCard';
import Header from './components/Header';
import Footer from './components/Footer';
import ContactForm from './components/ContactForm';
import LoginForm from './components/LoginForm';
import AddProductForm from './components/AddProductForm';
import PasswordForm from './components/PasswordForm';
import MyOrders from './components/MyOrders';
import OrdersPanel from './components/OrdersPanel';

function App() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cartCount, setCartCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));
  const [authNotice, setAuthNotice] = useState('');
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch('/products');
      if (!Array.isArray(data)) throw new Error('Сервер вернул некорректный каталог');
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch('/products').then((data) => {
      if (active) setProducts(data);
    }).catch((err) => {
      if (active) setError(err.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    let active = true;
    apiFetch('/auth/me', { token }).then((currentUser) => {
      if (active) setUser(currentUser);
    }).catch(() => {
      if (active) {
        localStorage.removeItem(TOKEN_KEY);
        setAuthNotice('Сеанс завершился. Войдите снова.');
      }
    }).finally(() => {
      if (active) setAuthLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setAuthNotice('');
  }, []);

  const handleAuthError = useCallback((err) => {
    if (err.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setAuthNotice('Сеанс завершился. Войдите снова.');
    }
  }, []);

  function handleAuthenticated(result) {
    localStorage.setItem(TOKEN_KEY, result.token);
    setUser(result.user);
    setAuthNotice('');
  }

  async function handleDelete(product) {
    if (!window.confirm(`Удалить товар «${product.name}»?`)) return;
    try {
      await apiFetch(`/products/${product.id}`, { method: 'DELETE' });
      await loadProducts();
    } catch (err) {
      setError(err.message);
      handleAuthError(err);
    }
  }

  function handleAddToCart() {
    setCartCount((count) => count + 1);
  }

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Header cartCount={cartCount} user={user} onLogout={handleLogout} />

      <main className="page">
        <section id="catalog" className="catalog">
          <div className="catalog-toolbar">
            <h2>Каталог</h2>
            <input
              className="search-input"
              type="search"
              placeholder="Поиск товара по каталогу..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading && <p className="status-message">Загрузка товаров...</p>}
          {error && <p className="form-error" role="alert">{error}</p>}

          {!loading && !error && (
            <div className="product-grid">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={handleAddToCart}
                    onDelete={user?.role === 'admin' ? handleDelete : undefined}
                    featured={product.id === 1}
                  />
                ))
              ) : (
                <p className="status-message">Товары не найдены</p>
              )}
            </div>
          )}
        </section>

        <aside id="delivery" className="sidebar">
          <h3>Доставка</h3>
          <ul>
            <li>Астана — на следующий день</li>
            <li>Акмолинская область — 2–3 дня</li>
            <li>Бесплатно от 20 000 тг</li>
          </ul>
        </aside>
        <ContactForm products={products} productsLoading={loading}
          onCreated={() => setOrdersRefreshKey((key) => key + 1)}
          onAuthError={handleAuthError} />
      </main>

      <div className="dashboard-layout">
        {authNotice && <p className="form-error" role="alert">{authNotice}</p>}
        {authLoading ? <p className="panel">Проверка сеанса…</p> : user ? <>
          <section id="auth" className="panel">
            <h2>Личный кабинет</h2>
            <p>Вы вошли как {user.name} ({user.role === 'admin' ? 'администратор' : 'пользователь'}).</p>
          </section>
          <PasswordForm onAuthError={handleAuthError} />
          <MyOrders refreshKey={ordersRefreshKey} onAuthError={handleAuthError} />
          {user.role === 'admin' && <>
            <AddProductForm onAdded={loadProducts} onAuthError={handleAuthError} />
            <OrdersPanel refreshKey={ordersRefreshKey} onAuthError={handleAuthError} />
          </>}
        </> : <LoginForm onAuthenticated={handleAuthenticated} />}
      </div>

      <Footer />
    </>
  );
}

export default App;
