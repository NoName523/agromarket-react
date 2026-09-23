import { useState, useEffect } from 'react';
import ProductCard from './components/ProductCard';

function App() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cartCount, setCartCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('http://localhost:3001/products');
        if (!response.ok) {
          throw new Error('Ошибка сервера');
        }
        const data = await response.json();
        setProducts(data);
      } catch (err) {
        setError('Не удалось загрузить товары');
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  function handleAddToCart() {
    setCartCount(cartCount + 1);
  }

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-container">
      <header className="header">
        <h1>🌾 АгроМаркет</h1>
        <div className="cart-badge">
          🛒 Корзина: {cartCount}
        </div>
      </header>

      <div className="search-container">
        <input
          className="search-input"
          type="text"
          placeholder="Поиск товара по каталогу..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <main>
        <h2 className="catalog-title">Каталог товаров</h2>

        {loading && <p className="status-message">Загрузка товаров...</p>}
        {error && <p className="status-message" style={{ color: '#e74c3c' }}>{error}</p>}

        {!loading && !error && (
          <div className="products-grid">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={handleAddToCart}
                />
              ))
            ) : (
              <p className="status-message">Товары не найдены</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;