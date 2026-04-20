import { useState } from "react"
import { requestPasswordReset, resetPasswordWithCode } from "../../api/auth"

interface ForgotPasswordPageProps {
  onBack: () => void
  language: "en" | "tr"
}

export const ForgotPasswordPage = ({ onBack, language }: ForgotPasswordPageProps) => {
  const [forgotEmail, setForgotEmail] = useState("")
  const [resetCode, setResetCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isEnglish = language === "en"

  const handleForgotPasswordRequest = async () => {
    try {
      setError(null)
      const response = await requestPasswordReset({ email: forgotEmail.trim().toLowerCase() })
      setMessage(`${response.message} ${isEnglish ? "Code expires in 10 minutes." : "Kod 10 dakika içinde geçersiz olur."}`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : isEnglish ? "Could not request reset code" : "Kod talebi başarısız")
    }
  }

  const handlePasswordReset = async () => {
    try {
      setError(null)
      const response = await resetPasswordWithCode({
        email: forgotEmail.trim().toLowerCase(),
        code: resetCode.trim(),
        new_password: newPassword,
      })
      setMessage(response.message)
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : isEnglish ? "Password reset failed" : "Şifre sıfırlama başarısız")
    }
  }

  return (
    <section className="forgot-page">
      <h2>{isEnglish ? "Forgot Password" : "Şifremi Unuttum"}</h2>
      <p className="subtitle">{isEnglish ? "Reset your password on this dedicated page." : "Şifrenizi bu özel sayfadan sıfırlayın."}</p>

      <label>
        {isEnglish ? "Email" : "E-posta"}
        <input value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="name@email.com" />
      </label>

      <button type="button" className="secondary" onClick={() => void handleForgotPasswordRequest()}>
        {isEnglish ? "Send Code" : "Kodu Gönder"}
      </button>

      <label>
        {isEnglish ? "Code" : "Kod"}
        <input value={resetCode} onChange={(event) => setResetCode(event.target.value)} placeholder={isEnglish ? "6-digit code" : "6 haneli kod"} />
      </label>

      <label>
        {isEnglish ? "New password" : "Yeni şifre"}
        <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
      </label>

      <button type="button" onClick={() => void handlePasswordReset()}>
        {isEnglish ? "Update Password" : "Şifreyi Güncelle"}
      </button>

      <button type="button" className="auth-link-button" onClick={onBack}>
        {isEnglish ? "Back to Sign In" : "Girişe Dön"}
      </button>

      {message ? <small>{message}</small> : null}
      {error ? <small className="error">{error}</small> : null}
    </section>
  )
}
