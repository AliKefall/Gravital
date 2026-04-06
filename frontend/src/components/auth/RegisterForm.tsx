import { useMemo, useState, type ChangeEvent } from "react"
import { registerUser } from "../../api/auth"
import type { RegisterRequest } from "../../types/auth"

type RegisterFormData = RegisterRequest

type RegisterFormErrors = {
  email?: string
  username?: string
  password?: string
}

interface RegisterFormProps {
  onSuccess?: (username: string) => void
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/

const normalizePayload = (data: RegisterFormData): RegisterFormData => {
  return {
    email: data.email.trim().toLowerCase(),
    username: data.username.trim(),
    password: data.password,
  }
}

const validate = (data: RegisterFormData): RegisterFormErrors => {
  const errors: RegisterFormErrors = {}
  if (!data.email.trim()) {
    errors.email = "Email is required."
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = "Please enter a valid email."
  }

  if (!data.username.trim()) {
    errors.username = "Username is required."
  } else if (!USERNAME_REGEX.test(data.username.trim())) {
    errors.username = "Username must be 3-32 chars and contain only letters, numbers, and _."
  }

  const password = data.password
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasDigit = /\d/.test(password)

  if (!password) {
    errors.password = "Password is required."
  } else if (password.length < 8 || password.length > 128 || !hasLetter || !hasDigit) {
    errors.password = "Password must be 8-128 chars and include at least one letter and one number."
  }

  return errors
}

export const RegisterForm = ({ onSuccess }: RegisterFormProps) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    email: "",
    username: "",
    password: "",
  })
  const [errors, setErrors] = useState<RegisterFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isFormValid = useMemo(() => {
    const nextErrors = validate(formData)
    return Object.keys(nextErrors).length === 0
  }, [formData])

  const onSubmit = async (event: ChangeEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)
    setSuccessMessage(null)

    const nextErrors = validate(formData)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const payload = normalizePayload(formData)
      const response = await registerUser(payload)
      setSuccessMessage(`Registration successful: ${response.username}.`)
      setFormData({
        email: "",
        username: "",
        password: "",
      })
      setErrors({})
      onSuccess?.(response.username)
    } catch (error) {
      const fallbackError = "An unexpected error occurred during registration."
      setServerError(error instanceof Error ? error.message : fallbackError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <h2>Create Account</h2>
      <p className="subtitle">Join the chat workspace with a new account.</p>

      <label htmlFor="register-email">Email</label>
      <input
        id="register-email"
        name="email"
        type="email"
        value={formData.email}
        onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
        aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? "email-error" : undefined}
        placeholder="ornek@mail.com"
      />
      {errors.email ? <small id="email-error" className="error">{errors.email}</small> : null}

      <label htmlFor="register-username">Username</label>
      <input
        id="register-username"
        name="username"
        type="text"
        value={formData.username}
        onChange={(event) => setFormData((prev) => ({ ...prev, username: event.target.value }))}
        aria-invalid={Boolean(errors.username)}
        aria-describedby={errors.username ? "username-error" : undefined}
        placeholder="username"
      />
      {errors.username ? <small id="username-error" className="error">{errors.username}</small> : null}

      <label htmlFor="register-password">Password</label>
      <input
        id="register-password"
        name="password"
        type="password"
        value={formData.password}
        onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
        aria-invalid={Boolean(errors.password)}
        aria-describedby={errors.password ? "password-error" : undefined}
        placeholder="••••••••"
      />
      {errors.password ? <small id="password-error" className="error">{errors.password}</small> : null}

      <button type="submit" disabled={isSubmitting || !isFormValid}>
        {isSubmitting ? "Registering..." : "Register"}
      </button>

      {serverError ? <div className="alert error">{serverError}</div> : null}
      {successMessage ? <div className="alert success">{successMessage}</div> : null}
    </form>
  )
}
