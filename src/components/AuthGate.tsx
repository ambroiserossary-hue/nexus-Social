import React, { useState, useEffect } from "react";
import { LogIn, UserPlus, HelpCircle, ShieldAlert, KeyRound, AlertTriangle, Check, X } from "lucide-react";

interface AuthGateProps {
  onLoginSuccess: (user: any) => void;
}

export default function AuthGate({ onLoginSuccess }: AuthGateProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot">("login");
  
  // Login States
  const [loginPseudo, setLoginPseudo] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Register States
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regPseudo, setRegPseudo] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const isAdminRequested = regPseudo.trim().endsWith("/admin");

  // Pseudo check indicator states
  const [pseudoStatus, setPseudoStatus] = useState<"empty" | "checking" | "available" | "taken">("empty");
  
  // Recovery States
  const [forgotPseudo, setForgotPseudo] = useState("");
  const [forgotFirstName, setForgotFirstName] = useState("");
  const [forgotLastName, setForgotLastName] = useState("");
  
  // UI States
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResetNotice, setShowResetNotice] = useState(false);

  // Fetch system reset notice
  useEffect(() => {
    fetch("/api/system-notice")
      .then(res => res.json())
      .then(data => {
        if (data && data.active) {
          setShowResetNotice(true);
        }
      })
      .catch(() => {});
  }, []);

  // Background username verification effect with simulated reflection
  useEffect(() => {
    const trimmed = regPseudo.trim();
    if (!trimmed) {
      setPseudoStatus("empty");
      return;
    }

    setPseudoStatus("checking");

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`);
        const data = await response.json();
        if (response.ok && data.available) {
          setPseudoStatus("available");
        } else {
          setPseudoStatus("taken");
        }
      } catch {
        setPseudoStatus("available"); // Fallback
      }
    }, 1200); // 1.2s delay to show reflection clearly

    return () => clearTimeout(timer);
  }, [regPseudo]);

  // Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPseudo || !loginPassword) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginPseudo, password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Échec de la connexion");
      }
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFirstName || !regLastName || !regPseudo || !regPassword) {
      setError("Tous les champs sont requis.");
      return;
    }
    
    // Check admin formulation constraint
    const endsWithAdmin = regPseudo.trim().endsWith("/admin");
    if (endsWithAdmin && adminCode !== "2Gt52026") {
      setError("Pour utiliser un pseudo se terminant par '/admin', vous devez entrer le code administrateur correct.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: regFirstName,
          lastName: regLastName,
          username: regPseudo,
          password: regPassword,
          isAdminRequested: endsWithAdmin || isAdminRequested,
          adminCode
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Échec de l'inscription");
      }
      
      setSuccess("Inscription réussie ! Veuillez maintenant vous connecter pour vérifier que votre compte a bien été enregistré dans notre base de données.");
      // Auto-populate login screen with the newly created pseudo
      setLoginPseudo(regPseudo);
      setActiveTab("login");
      // Clean inputs
      setRegFirstName("");
      setRegLastName("");
      setRegPseudo("");
      setRegPassword("");
      setAdminCode("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPseudo || !forgotFirstName || !forgotLastName) {
      setError("Toutes les informations d'identification sont requises.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: forgotPseudo,
          firstName: forgotFirstName,
          lastName: forgotLastName
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Échec de la demande");
      }
      setSuccess(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-gray-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Gemini Ambient Light Effect */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[130px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-cyan-900/10 blur-[130px]" />

      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative z-10 transition-all duration-300">
        
        {/* Logo and Brand in Google Gemini + Samsung Style */}
        <div className="text-center mb-8 relative">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-500 shadow-lg shadow-indigo-500/10 mb-3 animate-pulse">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white font-sans bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-cyan-200">
            Aura
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            Messagerie Privée & Souveraine • Style One UI 8.5
          </p>
        </div>

        {/* Global Alert Alerts */}
        {showResetNotice && (
          <div className="mb-5 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex gap-3 text-amber-200 text-xs font-semibold relative leading-snug">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[13px] text-amber-300">⚠️ Base de données nettoyée</p>
              <p className="mt-0.5 text-gray-300">Tout a été supprimé. Seul l'administrateur principal (Ambroise/admin) aura le rôle Admin suprême certifié lors de sa connexion. Les autres connexions se feront en tant que simples membres.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setShowResetNotice(false);
                try {
                  await fetch("/api/system-notice/dismiss", { method: "POST" });
                } catch {}
              }}
              className="absolute top-3 right-3 text-amber-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-5 p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-200 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-sm flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* login View */}
        {activeTab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5 ml-1">
                Pseudo (Nom d'utilisateur)
              </label>
              <input
                type="text"
                value={loginPseudo}
                onChange={(e) => setLoginPseudo(e.target.value)}
                placeholder="Ex: Sarah99"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/60 rounded-2xl py-3 px-4 text-sm text-white placeholder-gray-500 outline-none transition-all"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="block text-xs text-gray-400 font-medium">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("forgot");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Entrez votre mot de passe"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/60 rounded-2xl py-3 px-4 text-sm text-white placeholder-gray-500 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-2xl py-3 px-4 font-medium text-sm shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Se connecter
                </>
              )}
            </button>

            <div className="text-center mt-6 pt-4 border-t border-slate-800/50">
              <span className="text-xs text-gray-400">Nouveau sur l'application ?</span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("register");
                  setError(null);
                  setSuccess(null);
                }}
                className="block w-full text-center text-sm text-indigo-400 font-medium mt-1 hover:text-indigo-300 transition-colors"
              >
                Créer un compte maintenant
              </button>
            </div>
          </form>
        )}

        {/* register View */}
        {activeTab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1.5 ml-1">
                  Nom de famille
                </label>
                <input
                  type="text"
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                  placeholder="Votre nom"
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/60 rounded-2xl py-2.5 px-3.5 text-sm text-white placeholder-gray-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1.5 ml-1">
                  Prénom
                </label>
                <input
                  type="text"
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  placeholder="Votre prénom"
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/60 rounded-2xl py-2.5 px-3.5 text-sm text-white placeholder-gray-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="block text-xs text-gray-400 font-medium">
                  Pseudo choisi
                </label>
                {/* 3 small dots loader & feedback */}
                {pseudoStatus === "checking" && (
                  <span className="flex items-center gap-1 text-[11px] text-indigo-400 select-none">
                    Réflexion
                    <span className="inline-flex gap-0.5 items-center">
                      <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </span>
                )}
                {pseudoStatus === "available" && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 select-none">
                    <Check className="w-3 h-3" /> Pseudo libre
                  </span>
                )}
                {pseudoStatus === "taken" && (
                  <span className="flex items-center gap-1 text-[11px] text-red-400 select-none">
                    <X className="w-3.5 h-3.5" /> Déjà pris
                  </span>
                )}
              </div>
              <input
                type="text"
                value={regPseudo}
                onChange={(e) => setRegPseudo(e.target.value)}
                placeholder="Votre surnom ou pseudo unique"
                className={`w-full bg-slate-950/60 border rounded-2xl py-2.5 px-4 text-sm text-white placeholder-gray-500 outline-none transition-all ${
                  pseudoStatus === "available"
                    ? "border-emerald-500/50 focus:border-emerald-400"
                    : pseudoStatus === "taken"
                    ? "border-red-500/50 focus:border-red-450"
                    : "border-slate-800 focus:border-indigo-500/60"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5 ml-1">
                Mot de passe secret
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Choisir un mot de passe solide"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/60 rounded-2xl py-2.5 px-4 text-sm text-white placeholder-gray-500 outline-none transition-all"
              />
            </div>

            {/* Admin Optional Expansion */}
            {isAdminRequested && (
              <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-3 shadow-inner">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Vérification Sécurité</span>
                </div>
                <div>
                  <label className="block text-xs text-indigo-200/80 mb-1 ml-1 font-medium">
                    Code d'accès secret requis
                  </label>
                  <input
                    type="password"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    placeholder="Entrez le code requis"
                    className="w-full bg-slate-950/80 border border-indigo-500/40 focus:border-indigo-400 rounded-xl py-2 px-3 text-sm text-white placeholder-gray-600 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 text-white rounded-2xl py-3 px-4 font-medium text-sm shadow-lg shadow-indigo-500/10 hover:shadow-cyan-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Créer mon compte
                </>
              )}
            </button>

            <div className="text-center mt-6 pt-4 border-t border-slate-800/50">
              <span className="text-xs text-gray-400">Vous avez déjà un compte ?</span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("login");
                  setError(null);
                  setSuccess(null);
                }}
                className="block w-full text-center text-sm text-indigo-400 font-medium mt-1 hover:text-indigo-300 transition-colors"
              >
                Se connecter à l'espace membre
              </button>
            </div>
          </form>
        )}

        {/* Forgot password */}
        {activeTab === "forgot" && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="bg-amber-950/20 border border-amber-500/10 rounded-2xl p-3 text-xs text-amber-200/80 flex gap-2 mb-2 leading-relaxed">
              <HelpCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <span>
                La demande va notifier l'administrateur principal, qui pourra retrouver votre mot de passe et vous le restituer. Vous devrez le changer à la prochaine connexion.
              </span>
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5 ml-1">
                Pseudo exact
              </label>
              <input
                type="text"
                value={forgotPseudo}
                onChange={(e) => setForgotPseudo(e.target.value)}
                placeholder="Saisissez votre pseudo"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/60 rounded-2xl py-2.5 px-4 text-sm text-white placeholder-gray-500 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1.5 ml-1">
                  Nom de famille
                </label>
                <input
                  type="text"
                  value={forgotLastName}
                  onChange={(e) => setForgotLastName(e.target.value)}
                  placeholder="Dupont"
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/60 rounded-2xl py-2.5 px-3.5 text-sm text-white placeholder-gray-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1.5 ml-1">
                  Prénom
                </label>
                <input
                  type="text"
                  value={forgotFirstName}
                  onChange={(e) => setForgotFirstName(e.target.value)}
                  placeholder="Martin"
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500/60 rounded-2xl py-2.5 px-3.5 text-sm text-white placeholder-gray-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl py-3 px-4 font-medium text-sm shadow-lg hover:shadow-indigo-500/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Notifier Ambroise (Admin)"
              )}
            </button>

            <div className="text-center mt-6 pt-4 border-t border-slate-800/50">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("login");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-sm text-indigo-400 font-medium hover:text-indigo-300 transition-colors"
              >
                Retourner à l'identification
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
