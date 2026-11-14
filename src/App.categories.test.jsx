import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';
import App from './App';

vi.mock('./api', () => ({ TOKEN_KEY: 'agromarket_jwt', apiFetch: vi.fn() }));

const products = [
  { id: 1, name: 'Цветочный мёд', price: 1000, category: 'Мёд' },
  { id: 2, name: 'Пшеница', price: 500, category: 'Зерно' },
  { id: 3, name: 'Картофель', price: 200, category: null },
];

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path === '/categories') return [
      { name: 'Мёд', count: 1 }, { name: 'Зерно', count: 1 }, { name: null, count: 1 },
    ];
    if (path === '/products') return products;
    throw new Error('Unexpected API path');
  });
});

describe('catalog categories', () => {
  it('filters by category, combines with search, supports null categories and resets', async () => {
    render(<App />);
    const honey = await screen.findByRole('button', { name: 'Мёд (1)' });
    fireEvent.click(honey);
    expect(honey).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Цветочный мёд' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Пшеница' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'пшеница' } });
    expect(screen.queryByRole('heading', { name: 'Цветочный мёд' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Все категории' }));
    expect(screen.getByRole('heading', { name: 'Пшеница' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Без категории (1)' }));
    expect(screen.getByRole('heading', { name: 'Картофель' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Пшеница' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Все категории' }));
    expect(screen.getByRole('heading', { name: 'Пшеница' })).toBeInTheDocument();
  });

  it('keeps the catalog available when categories fail', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) => {
      if (path === '/categories') throw new Error('Categories unavailable');
      return products;
    });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Пшеница' })).toBeInTheDocument();
    expect(screen.getByText('Категории недоступны. Каталог работает без фильтра.')).toBeInTheDocument();
  });

  it('loads later product pages so category filters include the full catalog', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) => {
      if (path === '/categories') return [{ name: 'Мёд', count: 1 }, { name: 'Зерно', count: 20 }];
      if (path === '/products') return Array.from({ length: 20 }, (_, i) => ({
        id: i + 10, name: `Зерно ${i}`, price: 500, category: 'Зерно',
      }));
      if (path === '/products?limit=20&offset=20') return [products[0]];
      throw new Error('Unexpected API path');
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Мёд (1)' }));
    expect(screen.getByRole('heading', { name: 'Цветочный мёд' })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/products?limit=20&offset=20');
    expect(screen.queryByRole('heading', { name: 'Зерно 0' })).not.toBeInTheDocument();
  });
});
