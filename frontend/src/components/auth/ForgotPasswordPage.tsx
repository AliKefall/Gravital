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
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const isEnglish = language === "en"

  const handleForgotPasswordRequest = async () => {
    if (!forgotEmail.trim()) {
      setError(isEnglish ? "Please enter your email address first." : "Önce e-posta adresinizi girin.")
      return
    }

    try {
      setIsSendingCode(true)
      setError(null)
      setMessage(null)
      const response = await requestPasswordReset({ email: forgotEmail.trim().toLowerCase() })
      setMessage(`${response.message} ${isEnglish ? "Code expires in 10 minutes." : "Kod 10 dakika içinde geçersiz olur."}`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : isEnglish ? "Could not request reset code" : "Kod talebi başarısız")
    } finally {
      setIsSendingCode(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!forgotEmail.trim() || !resetCode.trim() || !newPassword.trim()) {
      setError(isEnglish ? "Email, code and new password are required." : "E-posta, kod ve yeni şifre zorunludur.")
      return
    }

    try {
      setIsResetting(true)
      setError(null)
      setMessage(null)
      const response = await resetPasswordWithCode({
        email: forgotEmail.trim().toLowerCase(),
        code: resetCode.trim(),
        new_password: newPassword,
      })
      setMessage(response.message)
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
          ? "Step 1: Enter your email and get a 6-digit code. Step 2: Enter the code and your new password."
          : "Adım 1: E-postanızı girip 6 haneli kod alın. Adım 2: Kodu ve yeni şifrenizi girin."}
      </p>
      <div className="auth-tip-box">
        {isEnglish
          ? "Tip: request a code first, then set your new password. Theme and language preferences stay the same."
          : "İpucu: önce kod isteyin, sonra yeni şifrenizi belirleyin. Tema ve dil tercihleriniz korunur."}
      </div>

      <label>
        {isEnglish ? "Email" : "E-posta"}
        <input value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="name@email.com" />
      </label>

      <button type="button" className="secondary" onClick={() => void handleForgotPasswordRequest()} disabled={isSendingCode}>
        {isSendingCode ? (isEnglish ? "Sending..." : "Gönderiliyor...") : (isEnglish ? "Send Code" : "Kodu Gönder")}
      </button>

      <label>
        {isEnglish ? "Code" : "Kod"}
        <input value={resetCode} onChange={(event) => setResetCode(event.target.value)} placeholder={isEnglish ? "6-digit code" : "6 haneli kod"} />
      </label>

      <label>
        {isEnglish ? "New password" : "Yeni şifre"}
        <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
      </label>

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
