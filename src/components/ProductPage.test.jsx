import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { API_URL } from '../api';
import { server } from '../test/server';
import App from '../App';
import ProductPage from './ProductPage';

describe('product page', () => {
  it('opens a direct product URL and renders the API product name', async () => {
    server.use(http.get(`${API_URL}/products/7`, () => HttpResponse.json({ id: 7, name: 'Яблоки', price: 500 })));
    window.history.replaceState(null, '', '/products/7');
    try {
      render(<App />);
      expect(await screen.findByRole('heading', { level: 1, name: 'Яблоки' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Вернуться в каталог' })).toHaveAttribute('href', '/#catalog');
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('shows a missing product error', async () => {
    server.use(http.get(`${API_URL}/products/999`, () => HttpResponse.json({ error: 'Товар не найден' }, { status: 404 })));
    render(<ProductPage id="999" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Товар не найден');
  });
});
