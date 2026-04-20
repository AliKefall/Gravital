import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { fetchSocialProviders, loginUser, requestPasswordReset, resetPasswordWithCode } from "../../api/auth"
import type { LoginRequest, LoginResponse, SocialProvidersResponse } from "../../types/auth"
import { AppIcon } from "../common/AppIcon"

type LoginFormErrors = {
  email?: string
  password?: string
}

type ResetErrors = {
  email?: string
  code?: string
  newPassword?: string
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
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [resetCode, setResetCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [resetErrors, setResetErrors] = useState<ResetErrors>({})
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [socialProviders, setSocialProviders] = useState<SocialProvidersResponse>({})

  const isValid = useMemo(() => Object.keys(validate(formData)).length === 0, [formData])

  useEffect(() => {
    fetchSocialProviders().then(setSocialProviders).catch(() => undefined)
  }, [])

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

  const handleForgotPasswordRequest = async () => {
    const nextErrors: ResetErrors = {}
    if (!EMAIL_REGEX.test(forgotEmail.trim())) {
      nextErrors.email = "Valid email is required"
    }
    setResetErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      const response = await requestPasswordReset({ email: forgotEmail.trim().toLowerCase() })
      setResetMessage(`${response.message} Code expires in 10 minutes.`)
    } catch (error) {
      setResetMessage(error instanceof Error ? error.message : "Could not request reset code")
    }
  }

  const handlePasswordReset = async () => {
    const nextErrors: ResetErrors = {}
    if (!EMAIL_REGEX.test(forgotEmail.trim())) nextErrors.email = "Valid email is required"
    if (!resetCode.trim()) nextErrors.code = "Code is required"
    if (newPassword.length < 8) nextErrors.newPassword = "New password must be at least 8 chars"
    setResetErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      const response = await resetPasswordWithCode({
        email: forgotEmail.trim().toLowerCase(),
        code: resetCode.trim(),
        new_password: newPassword,
      })
      setResetMessage(response.message)
      setShowForgotPassword(false)
    } catch (error) {
      setResetMessage(error instanceof Error ? error.message : "Password reset failed")
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
        placeholder="name@email.com"
      />
      {errors.email ? <small className="error">{errors.email}</small> : null}

      <label htmlFor="login-password">Password</label>
      <div className="password-input-row">
        <input
          id="login-password"
          type={showPassword ? "text" : "password"}
          value={formData.password}
          onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
          placeholder="••••••••"
        />
        <button
          type="button"
          className="password-toggle-button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          <AppIcon name={showPassword ? "eyeOff" : "eye"} />
        </button>
      </div>
      {errors.password ? <small className="error">{errors.password}</small> : null}

      <button type="submit" disabled={isSubmitting || !isValid}>
        {isSubmitting ? "Signing in..." : "Sign In"}
      </button>

      <div className="social-auth-row">
        <button type="button" className="secondary" onClick={() => (socialProviders.google ? (window.location.href = socialProviders.google) : setServerError("Google auth URL is not configured."))}>
          Continue with Google
        </button>
        <button type="button" className="secondary" onClick={() => (socialProviders.github ? (window.location.href = socialProviders.github) : setServerError("GitHub auth URL is not configured."))}>
          Continue with GitHub
        </button>
      </div>

      <button type="button" className="auth-link-button" onClick={() => setShowForgotPassword((prev) => !prev)}>
        Şifremi unuttum
      </button>

      {showForgotPassword ? (
        <section className="forgot-password-card">
          <label>
            E-posta
            <input value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="name@email.com" />
          </label>
          {resetErrors.email ? <small className="error">{resetErrors.email}</small> : null}

          <button type="button" className="secondary" onClick={() => void handleForgotPasswordRequest()}>
            Kodu gönder
          </button>

          <label>
            Kod
            <input value={resetCode} onChange={(event) => setResetCode(event.target.value)} placeholder="6 haneli kod" />
          </label>
          {resetErrors.code ? <small className="error">{resetErrors.code}</small> : null}

          <label>
            Yeni şifre
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Yeni şifre" />
          </label>
          {resetErrors.newPassword ? <small className="error">{resetErrors.newPassword}</small> : null}

          <button type="button" onClick={() => void handlePasswordReset()}>
            Şifreyi güncelle
          </button>
          {resetMessage ? <small>{resetMessage}</small> : null}
        </section>
      ) : null}

      {serverError ? <div className="alert error">{serverError}</div> : null}
    </form>
  )
}
