import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoginForm from './LoginForm';

describe('LoginForm', () => {
  it('shows the name field only during registration', () => {
    const { container, getAllByRole } = render(<LoginForm onAuthenticated={() => {}} />);
    expect(container.querySelector('#auth-name')).toBeNull();

    fireEvent.click(getAllByRole('button')[1]);
    expect(container.querySelector('#auth-name')).not.toBeNull();

    fireEvent.click(getAllByRole('button')[0]);
    expect(container.querySelector('#auth-name')).toBeNull();
  });
});
