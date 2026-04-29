import { useState } from "react"
import { LoginForm } from "../components/auth/LoginForm"
import { RegisterForm } from "../components/auth/RegisterForm"
import { ForgotPasswordPage } from "../components/auth/ForgotPasswordPage"
import type { LoginResponse } from "../types/auth"

interface AuthPageProps {
  onLogin: (session: LoginResponse) => void
  language: "en" | "tr"
}

export const AuthPage = ({ onLogin, language }: AuthPageProps) => {
  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot">("login")
  const isEnglish = language === "en"

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <header className="auth-header">
          <h1>Gravital Chat</h1>
          <p>{isEnglish ? "Welcome to the room-based chat app." : "Oda tabanlı sohbet uygulamasına hoş geldiniz."}</p>
        </header>
        <section className="auth-guide">
          <h3>{isEnglish ? "What can you do here?" : "Burada neler yapabilirsiniz?"}</h3>
          <ul>
            <li>{isEnglish ? "Create rooms and invite friends instantly." : "Oda oluşturun ve arkadaşlarınızı anında davet edin."}</li>
            <li>{isEnglish ? "Chat with text, images, videos, and files." : "Metin, görsel, video ve dosya ile sohbet edin."}</li>
            <li>{isEnglish ? "Join voice, share screen/camera, and track live metrics." : "Sese katılın, ekran/kamera paylaşın ve canlı metrikleri izleyin."}</li>
          </ul>
        </section>

        {activeTab !== "forgot" && (
          <div className="tab-row">
            <button className={activeTab === "login" ? "active" : ""} onClick={() => setActiveTab("login")}>
              {isEnglish ? "Sign In" : "Giriş"}
            </button>
            <button className={activeTab === "register" ? "active" : ""} onClick={() => setActiveTab("register")}>
              {isEnglish ? "Register" : "Kayıt Ol"}
            </button>
          </div>
        )}

        {activeTab === "login" ? (
          <LoginForm onSuccess={onLogin} language={language} onForgotPasswordNavigate={() => setActiveTab("forgot")} />
        ) : activeTab === "register" ? (
          <RegisterForm language={language} onSuccess={() => setActiveTab("login")} />
        ) : (
          <ForgotPasswordPage language={language} onBack={() => setActiveTab("login")} />
        )}
      </section>
    </main>
  )
}
