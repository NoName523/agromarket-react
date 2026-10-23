function Header({ cartCount = 0, user, onLogout }) {
  return (
    <header className="site-header">
      <a href="#catalog">🌾 АгроМаркет</a>
      <nav aria-label="Основная навигация">
        <ul className="nav-links">
          <li><a href="#catalog">Каталог</a></li>
          <li><a href="#delivery">Доставка</a></li>
          <li><a href="#contact">Контакты</a></li>
          <li><a href="#auth">{user ? 'Аккаунт' : 'Вход'}</a></li>
        </ul>
      </nav>
      <div className="header-actions">
        {user && <span className="user-name">Здравствуйте, {user.name}</span>}
        {user && <button type="button" className="logout-button" onClick={onLogout}>Выйти</button>}
        <div className="cart-badge">🛒 Корзина: {cartCount}</div>
      </div>
    </header>
  );
}

export default Header;
