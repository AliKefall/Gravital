import { useMemo, useState, type ChangeEvent } from "react"
import { loginUser } from "../../api/auth"
import type { LoginRequest, LoginResponse } from "../../types/auth"

type LoginFormErrors = {
  email?: string
  password?: string
}

interface LoginFormProps {
  onSuccess: (session: LoginResponse) => void
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validate = (data: LoginRequest): LoginFormErrors => {
  const errors: LoginFormErrors = {}

  if (!data.email.trim()) {
    errors.email = "Email is required."
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = "Please enter a valid email."
  }

  if (!data.password) {
    errors.password = "Password is required."
  }

  return errors
}

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const [formData, setFormData] = useState<LoginRequest>({ email: "", password: "" })
  const [errors, setErrors] = useState<LoginFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const isValid = useMemo(() => Object.keys(validate(formData)).length === 0, [formData])

  const onSubmit = async (event: ChangeEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)

    const nextErrors = validate(formData)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await loginUser({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      })
      onSuccess(response)
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Login failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <h2>Sign In</h2>
      <p className="subtitle">Sign in to continue chatting.</p>

      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        type="email"
        value={formData.email}
        onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
        placeholder="ornek@mail.com"
      />
      {errors.email ? <small className="error">{errors.email}</small> : null}

      <label htmlFor="login-password">Password</label>
      <input
        id="login-password"
        type="password"
        value={formData.password}
        onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
        placeholder="••••••••"
      />
      {errors.password ? <small className="error">{errors.password}</small> : null}

      <button type="submit" disabled={isSubmitting || !isValid}>
        {isSubmitting ? "Signing in..." : "Sign In"}
      </button>

      {serverError ? <div className="alert error">{serverError}</div> : null}
    </form>
  )
}
