import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProductCard from './ProductCard'

const product = {
  id: 7,
  name: '\u041e\u0440\u0433\u0430\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u044f\u0431\u043b\u043e\u043a\u0438',
  price: 1250,
  image: '/images/apples.jpg',
}

afterEach(cleanup)

describe('ProductCard', () => {
  it('shows the product name and price', () => {
    render(<ProductCard product={product} onAdd={vi.fn()} />)

    expect(screen.getByRole('heading', { name: product.name })).toBeInTheDocument()
    expect(screen.getByText(/1250/)).toBeInTheDocument()
  })

  it('calls onAdd with the product when the cart button is clicked', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<ProductCard product={product} onAdd={onAdd} />)

    await user.click(screen.getByRole('button', { name: '\u0412 \u043a\u043e\u0440\u0437\u0438\u043d\u0443' }))

    expect(onAdd).toHaveBeenCalledExactlyOnceWith(product)
  })

  it('shows the featured badge when featured is true', () => {
    render(<ProductCard product={product} onAdd={vi.fn()} featured />)

    expect(screen.getByText('\u0422\u043e\u0432\u0430\u0440 \u043d\u0435\u0434\u0435\u043b\u0438')).toBeInTheDocument()
  })

  it('shows a delete button and passes the product to onDelete', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<ProductCard product={product} onAdd={vi.fn()} onDelete={onDelete} />)
    const deleteButton = screen.getByRole('button', { name: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440' })

    await user.click(deleteButton)

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(product)
  })
})
