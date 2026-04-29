import { useEffect, useMemo, useState } from "react"
import { requestPasswordReset, resetPasswordWithCode } from "../../api/auth"

interface ForgotPasswordPageProps {
  onBack: () => void
  language: "en" | "tr"
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_REGEX = /^\d{6}$/
const SEND_COOLDOWN_SECONDS = 45

export const ForgotPasswordPage = ({ onBack, language }: ForgotPasswordPageProps) => {
  const [forgotEmail, setForgotEmail] = useState("")
  const [resetCode, setResetCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0)

  const isEnglish = language === "en"

  const passwordChecks = useMemo(
    () => ({
      minLength: newPassword.length >= 8,
      lower: /[a-z]/.test(newPassword),
      upper: /[A-Z]/.test(newPassword),
      number: /\d/.test(newPassword),
      symbol: /[^A-Za-z0-9]/.test(newPassword),
    }),
    [newPassword],
  )

  const isPasswordStrong = Object.values(passwordChecks).every(Boolean)

  useEffect(() => {
    if (cooldownSecondsLeft <= 0) {
      return
    }

    const timeout = window.setTimeout(() => {
      setCooldownSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => window.clearTimeout(timeout)
  }, [cooldownSecondsLeft])

  const genericRequestMessage = isEnglish
    ? "If this email exists, we sent a 6-digit reset code. It expires in 10 minutes."
    : "Bu e-posta kayıtlıysa 6 haneli sıfırlama kodu gönderildi. Kod 10 dakika içinde geçersiz olur."

  const handleForgotPasswordRequest = async () => {
    const trimmedEmail = forgotEmail.trim().toLowerCase()

    if (!trimmedEmail) {
      setError(isEnglish ? "Please enter your email address first." : "Önce e-posta adresinizi girin.")
      return
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError(isEnglish ? "Please enter a valid email address." : "Lütfen geçerli bir e-posta adresi girin.")
      return
    }

    if (cooldownSecondsLeft > 0) {
      setError(
        isEnglish
          ? `Please wait ${cooldownSecondsLeft} seconds before requesting another code.`
          : `Yeni kod istemek için ${cooldownSecondsLeft} saniye bekleyin.`,
      )
      return
    }

    try {
      setIsSendingCode(true)
      setError(null)
      setMessage(null)
      await requestPasswordReset({ email: trimmedEmail })
      setMessage(genericRequestMessage)
      setCooldownSecondsLeft(SEND_COOLDOWN_SECONDS)
    } catch {
      setMessage(genericRequestMessage)
      setCooldownSecondsLeft(SEND_COOLDOWN_SECONDS)
    } finally {
      setIsSendingCode(false)
    }
  }

  const handlePasswordReset = async () => {
    const trimmedEmail = forgotEmail.trim().toLowerCase()
    const trimmedCode = resetCode.trim()

    if (!trimmedEmail || !trimmedCode || !newPassword.trim()) {
      setError(isEnglish ? "Email, code and new password are required." : "E-posta, kod ve yeni şifre zorunludur.")
      return
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError(isEnglish ? "Please enter a valid email address." : "Lütfen geçerli bir e-posta adresi girin.")
      return
    }

    if (!CODE_REGEX.test(trimmedCode)) {
      setError(isEnglish ? "Code must be exactly 6 digits." : "Kod tam olarak 6 haneli olmalıdır.")
      return
    }

    if (!isPasswordStrong) {
      setError(
        isEnglish
          ? "Your new password must meet all security requirements below."
          : "Yeni şifreniz aşağıdaki tüm güvenlik gereksinimlerini karşılamalıdır.",
      )
      return
    }

    try {
      setIsResetting(true)
      setError(null)
      setMessage(null)
      const response = await resetPasswordWithCode({
        email: trimmedEmail,
        code: trimmedCode,
        new_password: newPassword,
      })
      setMessage(response.message)
      setResetCode("")
      setNewPassword("")
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : isEnglish ? "Password reset failed" : "Şifre sıfırlama başarısız")
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <section className="forgot-page">
      <h2>{isEnglish ? "Forgot Password" : "Şifremi Unuttum"}</h2>
      <p className="subtitle">
        {isEnglish
          ? "Step 1: Enter your email and request a 6-digit code. Step 2: Enter the code and a strong new password."
          : "Adım 1: E-postanızı girip 6 haneli kod isteyin. Adım 2: Kodu ve güçlü yeni şifrenizi girin."}
      </p>
      <div className="auth-tip-box">
        {isEnglish
          ? "Security tip: to protect accounts, code requests always return a generic result and are temporarily rate-limited."
          : "Güvenlik ipucu: hesapları korumak için kod talepleri her zaman genel sonuç döner ve geçici olarak hız sınırına alınır."}
      </div>

      <label>
        {isEnglish ? "Email" : "E-posta"}
        <input value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="name@email.com" autoComplete="email" />
      </label>

      <button type="button" className="secondary" onClick={() => void handleForgotPasswordRequest()} disabled={isSendingCode || cooldownSecondsLeft > 0}>
        {isSendingCode
          ? (isEnglish ? "Sending..." : "Gönderiliyor...")
          : cooldownSecondsLeft > 0
            ? (isEnglish ? `Resend in ${cooldownSecondsLeft}s` : `${cooldownSecondsLeft}s sonra tekrar`)
            : (isEnglish ? "Send Code" : "Kodu Gönder")}
      </button>

      <label>
        {isEnglish ? "Code" : "Kod"}
        <input
          value={resetCode}
          onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder={isEnglish ? "6-digit code" : "6 haneli kod"}
          inputMode="numeric"
          autoComplete="one-time-code"
        />
      </label>

      <label>
        {isEnglish ? "New password" : "Yeni şifre"}
        <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
      </label>

      <ul className="password-guideline">
        <li className={passwordChecks.minLength ? "pass" : ""}>{isEnglish ? "At least 8 characters" : "En az 8 karakter"}</li>
        <li className={passwordChecks.lower ? "pass" : ""}>{isEnglish ? "At least 1 lowercase letter" : "En az 1 küçük harf"}</li>
        <li className={passwordChecks.upper ? "pass" : ""}>{isEnglish ? "At least 1 uppercase letter" : "En az 1 büyük harf"}</li>
        <li className={passwordChecks.number ? "pass" : ""}>{isEnglish ? "At least 1 number" : "En az 1 rakam"}</li>
        <li className={passwordChecks.symbol ? "pass" : ""}>{isEnglish ? "At least 1 symbol" : "En az 1 sembol"}</li>
      </ul>

      <button type="button" onClick={() => void handlePasswordReset()} disabled={isResetting}>
        {isResetting ? (isEnglish ? "Updating..." : "Güncelleniyor...") : (isEnglish ? "Update Password" : "Şifreyi Güncelle")}
      </button>

      <button type="button" className="auth-link-button" onClick={onBack}>
        {isEnglish ? "Back to Sign In" : "Girişe Dön"}
      </button>

      {message ? <small>{message}</small> : null}
      {error ? <small className="error">{error}</small> : null}
    </section>
  )
}
