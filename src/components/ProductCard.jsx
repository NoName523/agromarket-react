function ProductCard({ product, onAdd, onDelete, featured }) {
    return (
        <article className={featured ? 'card card--featured' : 'card'}>
            {featured === true && <span className="badge">Товар недели</span>}
            <img src={product.image} alt={product.name} />
            <div className="card-body">
                <h3>{product.name}</h3>
                <p className="card-price">{product.price} тг</p>
                <button className="card-button" onClick={() => onAdd(product)}>
                    В корзину
                </button>
                {onDelete && <button type="button" className="delete-button"
                    onClick={() => onDelete(product)}>
                    Удалить товар
                </button>}
            </div>
        </article>
    );
}

export default ProductCard;
