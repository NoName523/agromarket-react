import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { API_URL } from '../api'
import { server } from '../test/server'
import LoginForm from './LoginForm'

afterEach(cleanup)

const text = {
  login: '\u0412\u0445\u043e\u0434',
  register: '\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f',
  group: '\u0420\u0435\u0436\u0438\u043c \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u0438',
  name: '\u0418\u043c\u044f',
  password: '\u041f\u0430\u0440\u043e\u043b\u044c',
  loginSubmit: '\u0412\u043e\u0439\u0442\u0438',
  registerSubmit: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442',
}

describe('LoginForm API interactions', () => {
  it('switches between login and registration modes', async () => {
    const user = userEvent.setup()
    render(<LoginForm onAuthenticated={vi.fn()} />)

    expect(screen.getByRole('heading', { name: text.login })).toBeInTheDocument()
    const modeGroup = screen.getByRole('group', { name: text.group })
    await user.click(within(modeGroup).getByRole('button', { name: text.register }))
    expect(screen.getByRole('heading', { name: text.register })).toBeInTheDocument()
    await user.click(within(modeGroup).getByRole('button', { name: text.login }))
    expect(screen.getByRole('heading', { name: text.login })).toBeInTheDocument()
  })

  it('shows the name field in registration mode and hides it in login mode', async () => {
    const user = userEvent.setup()
    render(<LoginForm onAuthenticated={vi.fn()} />)
    const modeGroup = screen.getByRole('group', { name: text.group })

    expect(screen.queryByLabelText(text.name)).not.toBeInTheDocument()
    await user.click(within(modeGroup).getByRole('button', { name: text.register }))
    expect(screen.getByLabelText(text.name)).toBeInTheDocument()
    await user.click(within(modeGroup).getByRole('button', { name: text.login }))
    expect(screen.queryByLabelText(text.name)).not.toBeInTheDocument()
  })

  it('submits valid registration data and reports the authenticated result', async () => {
    const user = userEvent.setup()
    const onAuthenticated = vi.fn()
    const result = { token: 'test-user-token', user: { id: 12, email: 'sam@example.com', name: 'Sam Farmer', role: 'user' } }
    let registrationBody
    server.use(http.post(`${API_URL}/auth/register`, async ({ request }) => {
      registrationBody = await request.json()
      return HttpResponse.json(result, { status: 201 })
    }))
    render(<LoginForm onAuthenticated={onAuthenticated} />)
    const modeGroup = screen.getByRole('group', { name: text.group })
    await user.click(within(modeGroup).getByRole('button', { name: text.register }))
    await user.type(screen.getByLabelText(text.name), 'Sam Farmer')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.type(screen.getByLabelText(text.password), 'securepass123')
    await user.click(screen.getByRole('button', { name: text.registerSubmit }))

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(result))
    expect(registrationBody).toEqual({ name: 'Sam Farmer', email: 'sam@example.com', password: 'securepass123' })
  })

  it('shows an API error when login fails', async () => {
    const user = userEvent.setup()
    server.use(http.post(`${API_URL}/auth/login`, () =>
      HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })))
    render(<LoginForm onAuthenticated={vi.fn()} />)
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.type(screen.getByLabelText(text.password), 'wrongpass')
    await user.click(screen.getByRole('button', { name: text.loginSubmit }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials')
  })
})
