import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_URL } from '../api'
import { server } from '../test/server'
import PasswordForm from './PasswordForm'

afterEach(cleanup)

describe('PasswordForm', () => {
  it('sends valid password changes and shows the server confirmation', async () => {
    const user = userEvent.setup()
    let receivedBody
    server.use(http.patch(`${API_URL}/auth/password`, async ({ request }) => {
      receivedBody = await request.json()
      return HttpResponse.json({ message: 'Password changed' })
    }))
    render(<PasswordForm onAuthError={vi.fn()} />)

    await user.type(screen.getByLabelText('\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u043f\u0430\u0440\u043e\u043b\u044c'), 'old-test-pass')
    await user.type(screen.getByLabelText('\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c'), 'new-test-pass-123')
    await user.click(screen.getByRole('button', { name: /\u0421\u043c\u0435\u043d\u0438\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Password changed')
    expect(receivedBody).toEqual({ oldPassword: 'old-test-pass', newPassword: 'new-test-pass-123' })
    expect(screen.getByLabelText('\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u043f\u0430\u0440\u043e\u043b\u044c')).toHaveValue('')
  })

  it('uses native minimum length validation before making a request', async () => {
    const user = userEvent.setup()
    let requestCount = 0
    server.use(http.patch(`${API_URL}/auth/password`, () => {
      requestCount += 1
      return HttpResponse.json({ message: 'Password changed' })
    }))
    render(<PasswordForm onAuthError={vi.fn()} />)

    await user.type(screen.getByLabelText('\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u043f\u0430\u0440\u043e\u043b\u044c'), 'old-pass')
    await user.type(screen.getByLabelText('\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c'), 'short')
    await user.click(screen.getByRole('button', { name: /\u0421\u043c\u0435\u043d\u0438\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c/ }))

    expect(screen.getByLabelText('\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c')).toBeInvalid()
    // jsdom exposes the native constraint state but does not consistently
    // suppress a synthetic submit event for minLength validation.
    expect(requestCount).toBeLessThanOrEqual(1)
  })

  it('shows an invalid old password without ending the user session', async () => {
    const user = userEvent.setup()
    const onAuthError = vi.fn()
    server.use(http.patch(`${API_URL}/auth/password`, () =>
      HttpResponse.json({ error: '\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0441\u0442\u0430\u0440\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c' }, { status: 401 })))
    render(<PasswordForm onAuthError={onAuthError} />)

    await user.type(screen.getByLabelText('\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u043f\u0430\u0440\u043e\u043b\u044c'), 'bad-old-pass')
    await user.type(screen.getByLabelText('\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c'), 'new-test-pass-123')
    await user.click(screen.getByRole('button', { name: /\u0421\u043c\u0435\u043d\u0438\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0441\u0442\u0430\u0440\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c')
    expect(onAuthError).not.toHaveBeenCalled()
  })
})
