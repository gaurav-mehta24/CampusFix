
import { useState } from "react";
import "./Auth.css";

const API = "http://localhost:5001";

export default function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "login" : "register";

      const response = await fetch(`${API}/api/auth/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          mode === "login"
            ? { email, password }
            : { name, email, password }
        ),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Authentication failed.");
      }

      if (mode === "register") {
        setMode("login");
        setPassword("");
        setError("Account created! Please log in.");
        return;
      }

      onAuthSuccess({
        token: result.token,
        user: result.user,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-icon">C</span>
          <span>Campus<span>Fix</span></span>
        </div>

        <div className="auth-heading">
          <span className="auth-eyebrow">
            SMART CAMPUS MANAGEMENT
          </span>

          <h1>
            {mode === "login" ? "Welcome back!" : "Join CampusFix"}
          </h1>

          <p>
            {mode === "login"
              ? "Log in to report and track campus issues."
              : "Create your student account to get started."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              Full name
              <input
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>

          {error && (
            <div className="auth-message" role="status">
              {error}
            </div>
          )}

          <button className="auth-submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Log In →"
              : "Create Account →"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Register" : "Log In"}
          </button>
        </div>

        <p className="auth-note">
          Student registration is open. Staff and Admin accounts require
          authorized account creation.
        </p>
      </div>
    </div>
  );
}
