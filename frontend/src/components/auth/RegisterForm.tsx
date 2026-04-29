import { useMemo, useState, type ChangeEvent } from "react"
import { registerUser } from "../../api/auth"
import type { RegisterRequest } from "../../types/auth"
import { AppIcon } from "../common/AppIcon"

type RegisterFormData = RegisterRequest

type RegisterFormErrors = {
  email?: string
  username?: string
  password?: string
}

interface RegisterFormProps {
  onSuccess?: (username: string) => void
  language: "en" | "tr"
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

export const RegisterForm = ({ onSuccess, language }: RegisterFormProps) => {
  const isEnglish = language === "en"
  const [formData, setFormData] = useState<RegisterFormData>({
    email: "",
    username: "",
    password: "",
  })
  const [errors, setErrors] = useState<RegisterFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const labels = useMemo(() => ({
    passwordGuidelines: isEnglish
      ? ["8-128 characters", "At least one uppercase letter", "At least one lowercase letter", "At least one number"]
      : ["8-128 karakter", "En az bir büyük harf", "En az bir küçük harf", "En az bir rakam"],
    showPassword: isEnglish ? "Show password" : "Şifreyi göster",
    hidePassword: isEnglish ? "Hide password" : "Şifreyi gizle",
    successPrefix: isEnglish ? "Registration successful" : "Kayıt başarılı",
    fallbackError: isEnglish ? "An unexpected error occurred during registration." : "Kayıt sırasında beklenmeyen bir hata oluştu.",
  }), [isEnglish])

  const isFormValid = useMemo(() => {
    const nextErrors = validate(formData)
    return Object.keys(nextErrors).length === 0
  }, [formData])

  const passwordChecks = useMemo(() => {
    const password = formData.password
    return {
      length: password.length >= 8 && password.length <= 128,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      digit: /\d/.test(password),
    }
  }, [formData.password])

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
      setSuccessMessage(`${labels.successPrefix}: ${response.username}. ${isEnglish ? "Your recovery code" : "Kurtarma kodunuz"}: ${response.recovery_code}`)
      setFormData({
        email: "",
        username: "",
        password: "",
      })
      setErrors({})
      onSuccess?.(response.username)
    } catch (error) {
      const fallbackError = labels.fallbackError
      setServerError(error instanceof Error ? error.message : fallbackError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <h2>{isEnglish ? "Create Account" : "Hesap Oluştur"}</h2>
      <p className="subtitle">{isEnglish ? "Join the chat workspace with a new account." : "Yeni bir hesapla sohbete katılın."}</p>

      <label htmlFor="register-email">Email</label>
      <input
        id="register-email"
        name="email"
        type="email"
        value={formData.email}
        onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
        aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? "email-error" : undefined}
        placeholder="name@email.com"
      />
      {errors.email ? <small id="email-error" className="error">{errors.email}</small> : null}

      <label htmlFor="register-username">{isEnglish ? "Username" : "Kullanıcı adı"}</label>
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

      <label htmlFor="register-password">{isEnglish ? "Password" : "Şifre"}</label>
      <div className="password-input-row">
        <input
          id="register-password"
          name="password"
          type={showPassword ? "text" : "password"}
          value={formData.password}
          onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : "password-guideline"}
          placeholder="••••••••"
        />
        <button
          type="button"
          className="password-toggle-button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? labels.hidePassword : labels.showPassword}
        >
          <AppIcon name={showPassword ? "eyeOff" : "eye"} />
        </button>
      </div>
      <ul id="password-guideline" className="password-guideline">
        <li className={passwordChecks.length ? "pass" : ""}>{labels.passwordGuidelines[0]}</li>
        <li className={passwordChecks.upper ? "pass" : ""}>{labels.passwordGuidelines[1]}</li>
        <li className={passwordChecks.lower ? "pass" : ""}>{labels.passwordGuidelines[2]}</li>
        <li className={passwordChecks.digit ? "pass" : ""}>{labels.passwordGuidelines[3]}</li>
      </ul>
      {errors.password ? <small id="password-error" className="error">{errors.password}</small> : null}

      <button type="submit" disabled={isSubmitting || !isFormValid}>
        {isSubmitting ? (isEnglish ? "Registering..." : "Kayıt oluşturuluyor...") : (isEnglish ? "Register" : "Kayıt Ol")}
      </button>

      {serverError ? <div className="alert error">{serverError}</div> : null}
      {successMessage ? <div className="alert success">{successMessage}</div> : null}
    </form>
  )
}
