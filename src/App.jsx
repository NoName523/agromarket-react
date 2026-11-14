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
import ServerWakeNotice from './components/ServerWakeNotice';

async function fetchCatalog() {
  const categoriesRequest = apiFetch('/categories').catch(() => null);
  const productsRequest = (async () => {
    const products = [];
    for (let offset = 0; ; offset += 20) {
      const page = await apiFetch(offset ? `/products?limit=20&offset=${offset}` : '/products');
      if (!Array.isArray(page)) throw new Error('Сервер вернул некорректный каталог');
      products.push(...page);
      if (page.length < 20) return products;
    }
  })();
  const [products, categories] = await Promise.all([productsRequest, categoriesRequest]);
  const validCategories = Array.isArray(categories) && categories.every((category) =>
    category && (category.name === null || typeof category.name === 'string') &&
    Number.isInteger(category.count) && category.count > 0);
  return { products, categories: validCategories ? categories : null };
}

function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(undefined);
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
      const data = await fetchCatalog();
      setProducts(data.products);
      setCategories(data.categories ?? []);
      setCategoryError(data.categories === null);
      setSelectedCategory((selected) => data.categories?.some((category) => category.name === selected)
        ? selected : undefined);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchCatalog().then((data) => {
      if (active) {
        setProducts(data.products);
        setCategories(data.categories ?? []);
        setCategoryError(data.categories === null);
      }
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
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedCategory === undefined || product.category === selectedCategory)
  );

  return (
    <>
      <Header cartCount={cartCount} user={user} onLogout={handleLogout} />
      <ServerWakeNotice />

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

          {categories.length > 0 && (
            <div className="category-filters" role="group" aria-label="Категории товаров">
              <button type="button" aria-pressed={selectedCategory === undefined}
                onClick={() => setSelectedCategory(undefined)}>Все категории</button>
              {categories.map((category) => (
                <button type="button" key={JSON.stringify(category.name)}
                  aria-pressed={selectedCategory === category.name}
                  onClick={() => setSelectedCategory(category.name)}>
                  {category.name === null ? 'Без категории' : category.name || 'Пустая категория'} ({category.count})
                </button>
              ))}
            </div>
          )}
          {categoryError && <p className="status-message">Категории недоступны. Каталог работает без фильтра.</p>}
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
