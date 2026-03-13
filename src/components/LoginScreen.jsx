import { useState } from "react";
import { supabase } from "../supabase.js";

export default function LoginScreen() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const f = "'DM Sans',sans-serif";
  const inputStyle = { width:"100%", padding:"14px 16px", background:"#1E2122", border:"1px solid #2C3032", borderRadius:12, color:"#fff", fontSize:16, fontFamily:f, outline:"none", marginBottom:10, display:"block", boxSizing:"border-box" };
  const btnStyle = (disabled) => ({ width:"100%", padding:"15px", background:"#E8A030", color:"#000", border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:f, transition:"opacity .15s", opacity: disabled ? .6 : 1, marginTop:4 });

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message);
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password) return;
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess("Account created! Check your email to confirm, then sign in.");
    setMode("signin");
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError("Enter your email first"); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess("Password reset email sent! Check your inbox.");
    setMode("signin");
  };

  return (
    <div style={{ position:"fixed", inset:0, display:"flex", flexDirection:"column", background:"#101213", fontFamily:f }}>
      {/* Branding */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 32px" }}>
        <div style={{ fontSize:36, fontWeight:700, color:"#fff", letterSpacing:"-.02em", marginBottom:10 }}>Clearwork</div>
        <div style={{ fontSize:14, color:"#555", textAlign:"center", lineHeight:1.6, maxWidth:240 }}>The Productivity App that makes you love getting things done</div>
      </div>

      {/* Form */}
      <div style={{ padding:"28px 24px 52px", borderTop:"1px solid #1E2122" }}>
        <div style={{ maxWidth:340, margin:"0 auto" }}>

          {/* Tab switcher */}
          <div style={{ display:"flex", gap:0, marginBottom:20, background:"#1E2122", borderRadius:12, padding:4 }}>
            {[["signin","Sign In"],["signup","Sign Up"]].map(([m, lbl]) => (
              <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                style={{ flex:1, padding:"9px", border:"none", borderRadius:9, fontFamily:f, fontSize:13, fontWeight:600, cursor:"pointer", transition:"all .15s",
                  background: mode === m ? "#2C3032" : "transparent",
                  color: mode === m ? "#fff" : "#666"
                }}>{lbl}</button>
            ))}
          </div>

          {success && <div style={{ fontSize:13, color:"#45C17A", marginBottom:12, padding:"10px 12px", background:"rgba(69,193,122,.08)", borderRadius:8 }}>{success}</div>}
          {error && <div style={{ fontSize:13, color:"#E05555", marginBottom:10 }}>{error}</div>}

          {mode === "forgot" ? (
            <>
              <div style={{ fontSize:13, color:"#888", marginBottom:14 }}>Enter your email and we'll send a reset link.</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} autoFocus />
              <button onClick={handleForgot} disabled={loading} style={btnStyle(loading)}>{loading ? "Sending…" : "Send Reset Link"}</button>
              <button onClick={() => { setMode("signin"); setError(""); }} style={{ width:"100%", padding:"12px", background:"none", border:"none", color:"#666", fontSize:13, cursor:"pointer", fontFamily:f, marginTop:8 }}>← Back to sign in</button>
            </>
          ) : (
            <>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && (mode==="signin" ? handleSignIn() : handleSignUp())} placeholder="you@example.com" style={inputStyle} autoFocus />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && (mode==="signin" ? handleSignIn() : handleSignUp())} placeholder="Password" style={inputStyle} />
              <button onClick={mode === "signin" ? handleSignIn : handleSignUp} disabled={loading} style={btnStyle(loading)}>
                {loading ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
              </button>
              {mode === "signin" && (
                <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} style={{ width:"100%", padding:"12px", background:"none", border:"none", color:"#666", fontSize:13, cursor:"pointer", fontFamily:f, marginTop:4 }}>Forgot password?</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
