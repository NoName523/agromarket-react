function ProductCard({ product, onAdd }) {
    return (
        <article className="card">
            <img src={product.image} alt={product.name} />
            <div className="card-body">
                <h3>{product.name}</h3>
                <p className="card-price">{product.price} тг</p>
                <button className="card-button" onClick={() => onAdd(product)}>
                    В корзину
                </button>
            </div>
        </article>
    );
}

export default ProductCard;