import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api';
import LoginForm from './LoginForm';
import AddProductForm from './AddProductForm';

vi.mock('../api', () => ({ apiFetch: vi.fn() }));

beforeEach(() => vi.mocked(apiFetch).mockReset());
afterEach(cleanup);

function change(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function renderAuth(register = false) {
  const onAuthenticated = vi.fn();
  const view = render(<LoginForm onAuthenticated={onAuthenticated} />);
  if (register) {
    fireEvent.click(within(screen.getByRole('group', { name: 'Режим авторизации' }))
      .getByRole('button', { name: 'Регистрация' }));
    change('Имя', 'Buyer');
  }
  change('Email', 'buyer@example.com');
  change('Пароль', 'password123');
  return { ...view, onAuthenticated };
}

function renderProduct() {
  const onAdded = vi.fn();
  const onAuthError = vi.fn();
  const view = render(<AddProductForm onAdded={onAdded} onAuthError={onAuthError} />);
  change('Название', 'Honey');
  change('Цена, тг', '100');
  return { ...view, onAdded, onAuthError };
}

describe('shared schema validation in forms', () => {
  it.each([false, true])('invalid email does not call API (register=%s)', (register) => {
    const { container } = renderAuth(register);
    change('Email', 'invalid');
    // Submit directly to exercise safeParse independently of native HTML validation.
    fireEvent.submit(container.querySelector('form'));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/email/i);
  });

  it('seven-character registration password does not call API', () => {
    const { container } = renderAuth(true);
    change('Пароль', '1234567');
    fireEvent.submit(container.querySelector('form'));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/8/);
  });

  it('submits normalized registration data without unknown form fields', async () => {
    const { container, onAuthenticated } = renderAuth(true);
    const result = { user: { id: 1, role: 'user' }, token: 'test-token' };
    vi.mocked(apiFetch).mockResolvedValue(result);
    change('Имя', ' Buyer ');
    change('Email', ' Buyer@Example.COM ');
    const extra = document.createElement('input');
    extra.name = 'role';
    extra.value = 'admin';
    container.querySelector('form').append(extra);
    fireEvent.submit(container.querySelector('form'));
    expect(apiFetch).toHaveBeenCalledWith('/auth/register', {
      method: 'POST', token: null,
      body: { name: 'Buyer', email: 'buyer@example.com', password: 'password123' },
    });
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(result));
  });

  it('normalizes login email and preserves API errors', async () => {
    const { container } = renderAuth();
    change('Email', ' Buyer@Example.COM ');
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Invalid credentials'));
    await act(async () => {
      fireEvent.submit(container.querySelector('form'));
    });
    expect(apiFetch).toHaveBeenCalledWith('/auth/login', {
      method: 'POST', token: null,
      body: { email: 'buyer@example.com', password: 'password123' },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it.each(['1.5', '1e3'])('rejects raw product price %s without calling API', (price) => {
    const { container, onAuthError } = renderProduct();
    change('Цена, тг', price);
    expect(screen.getByLabelText('Цена, тг').value).toBe(price);
    fireEvent.submit(container.querySelector('form'));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(onAuthError).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Цена, тг')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement();
  });

  it('rejects a negative price with a clear error and no request', () => {
    const { container } = renderProduct();
    change('Цена, тг', '-500');
    fireEvent.submit(container.querySelector('form'));
    expect(screen.getByRole('alert')).toHaveTextContent('Цена должна быть больше 0');
    expect(screen.getByLabelText('Цена, тг')).toHaveAttribute('aria-invalid', 'true');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('submits a numeric price, trims product name and strips unknown fields', async () => {
    const { container, onAdded, onAuthError } = renderProduct();
    change('Название', ' Honey ');
    vi.mocked(apiFetch).mockResolvedValue({ id: 1, name: 'Honey' });
    const extra = document.createElement('input');
    extra.name = 'role';
    extra.value = 'admin';
    container.querySelector('form').append(extra);
    fireEvent.submit(container.querySelector('form'));
    expect(apiFetch).toHaveBeenCalledWith('/products', {
      method: 'POST',
      body: { name: 'Honey', price: 100, category: null, unit: 'кг', image: null },
    });
    await waitFor(() => expect(onAdded).toHaveBeenCalledOnce());
    expect(onAuthError).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Honey');
  });
});
