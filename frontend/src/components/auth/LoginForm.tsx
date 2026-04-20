import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { fetchSocialProviders, loginUser } from "../../api/auth"
import type { LoginRequest, LoginResponse, SocialProvidersResponse } from "../../types/auth"
import { AppIcon } from "../common/AppIcon"

type LoginFormErrors = {
  email?: string
  password?: string
}

interface LoginFormProps {
  onSuccess: (session: LoginResponse) => void
  language: "en" | "tr"
  onForgotPasswordNavigate: () => void
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

export const LoginForm = ({ onSuccess, language, onForgotPasswordNavigate }: LoginFormProps) => {
  const [formData, setFormData] = useState<LoginRequest>({ email: "", password: "" })
  const [errors, setErrors] = useState<LoginFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [socialProviders, setSocialProviders] = useState<SocialProvidersResponse>({})
  const isEnglish = language === "en"

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

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <h2>{isEnglish ? "Sign In" : "Giriş Yap"}</h2>
      <p className="subtitle">{isEnglish ? "Sign in to continue chatting." : "Sohbete devam etmek için giriş yapın."}</p>

      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        type="email"
        value={formData.email}
        onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
        placeholder="name@email.com"
      />
      {errors.email ? <small className="error">{errors.email}</small> : null}

      <label htmlFor="login-password">{isEnglish ? "Password" : "Şifre"}</label>
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
        {isSubmitting ? (isEnglish ? "Signing in..." : "Giriş yapılıyor...") : (isEnglish ? "Sign In" : "Giriş Yap")}
      </button>

      <div className="social-auth-row">
        <button type="button" className="secondary" onClick={() => (socialProviders.google ? (window.location.href = socialProviders.google) : setServerError("Google auth URL is not configured."))}>
          {isEnglish ? "Continue with Google" : "Google ile devam et"}
        </button>
        <button type="button" className="secondary" onClick={() => (socialProviders.github ? (window.location.href = socialProviders.github) : setServerError("GitHub auth URL is not configured."))}>
          {isEnglish ? "Continue with GitHub" : "GitHub ile devam et"}
        </button>
      </div>

      <button type="button" className="auth-link-button" onClick={onForgotPasswordNavigate}>
        {isEnglish ? "Forgot Password?" : "Şifremi unuttum"}
      </button>

      {serverError ? <div className="alert error">{serverError}</div> : null}
    </form>
  )
}
