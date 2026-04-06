import { useState } from "react"
import { LoginForm } from "../components/auth/LoginForm"
import { RegisterForm } from "../components/auth/RegisterForm"
import type { LoginResponse } from "../types/auth"

interface AuthPageProps {
  onLogin: (session: LoginResponse) => void
}

export const AuthPage = ({ onLogin }: AuthPageProps) => {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login")

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <header className="auth-header">
          <h1>Gravital Chat</h1>
          <p>Welcome to the room-based chat app.</p>
        </header>

        <div className="tab-row">
          <button className={activeTab === "login" ? "active" : ""} onClick={() => setActiveTab("login")}>
            Sign In
          </button>
          <button className={activeTab === "register" ? "active" : ""} onClick={() => setActiveTab("register")}>
            Register
          </button>
        </div>

        {activeTab === "login" ? (
          <LoginForm onSuccess={onLogin} />
        ) : (
          <RegisterForm onSuccess={() => setActiveTab("login")} />
        )}
      </section>
    </main>
  )
}
