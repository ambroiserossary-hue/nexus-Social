import React, { useState, useEffect } from "react";
import { LogOut, User, RefreshCw, AlertCircle, Clock, CheckCircle2, Lock } from "lucide-react";

interface ProfileTabProps {
  user: any;
  onLogout: () => void;
  onPseudoUpdated: (newPseudo: string) => void;
  xUserId: string;
}

export default function ProfileTab({ user, onLogout, onPseudoUpdated, xUserId }: ProfileTabProps) {
  const [newPseudo, setNewPseudo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [stats, setStats] = useState({
    createdAt: "",
    pseudoUpdatedAt: "",
  });

  // Fetch updated user stats (to get last update time for pseudo)
  const fetchUserStats = async () => {
    try {
      const response = await fetch("/api/users", {
        headers: { "x-user-id": xUserId }
      });
      const data = await response.json();
      if (response.ok && data.users) {
        // Find myself
        const me = data.users.find((u: any) => u.id === xUserId);
        if (me) {
          // If the profile endpoint had dates, we can use them.
          // Since our user object from App has some, we can use the latest.
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUserStats();
  }, []);

  const handleUpdatePseudo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPseudo.trim()) {
      setError("Le pseudo ne peut pas être vide.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/users/update-pseudo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": xUserId,
        },
        body: JSON.stringify({ newPseudo: newPseudo.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Impossible de mettre à jour le pseudo.");
      }

      setSuccess("Pseudo modifié avec succès !");
      onPseudoUpdated(data.username);
      setNewPseudo("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setPasswordError("Le mot de passe ne peut pas être vide.");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError("Le mot de passe doit faire au moins 4 caractères.");
      return;
    }
    
    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const response = await fetch("/api/users/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": xUserId,
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Impossible de modifier le mot de passe.");
      }

      setPasswordSuccess("Mot de passe modifié avec succès !");
      setNewPassword("");
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-5">
      
      {/* Upper header */}
      <div>
        <h2 className="text-2xl font-semibold text-white tracking-tight">Mon Profil</h2>
        <p className="text-xs text-gray-400 mt-1">
          Gérez votre pseudo, votre niveau de sécurité et connectez d'autres terminaux.
        </p>
      </div>

      {/* Visual profile Display card */}
      <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-900 flex flex-col items-center text-center relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-3">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${
            user.role === "admin" 
              ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20" 
              : "bg-slate-950/40 text-gray-400 border border-slate-800"
          }`}>
            {user.role === "admin" ? "🛡️ ADM / MODERATEUR" : "👥 MEMBRE CLASSE"}
          </span>
        </div>

        <div className="relative mt-2">
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-20 h-20 rounded-3xl object-cover bg-slate-800 border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/5 mb-3"
          />
          <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-slate-950" />
        </div>

        <h3 className="text-lg font-bold text-white tracking-tight">{user.username}</h3>
        <p className="text-xs text-gray-400 mt-1">
          {user.firstName} {user.lastName}
        </p>

        <div className="w-full grid grid-cols-2 gap-2 mt-5 text-[11px] text-gray-400 text-left pt-3 border-t border-slate-800/60">
          <div>
            <span className="block text-[10px] text-gray-500 font-medium">STATUT SYSTÈME</span>
            <span className="text-emerald-400 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Connecté
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-gray-500 font-medium font-sans">COOLDOWN PSEUDO</span>
            <span className="text-indigo-300 flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5" />
              {user.role === "admin" ? "Aucun limiteur" : "2 Heures"}
            </span>
          </div>
        </div>
      </div>

      {/* Change pseudo Interaction Block */}
      <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-900 space-y-3 shadow-xl">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <RefreshCw className="w-4.5 h-4.5 text-indigo-400" />
          Changer de Pseudo
        </h4>
        
        <p className="text-xs text-gray-400 leading-normal">
          Les élèves peuvent modifier leur pseudo <strong>toutes les 2 heures maximum</strong> pour éviter les abus ou usurpations dans le groupe classe.
        </p>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/20 text-red-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 text-emerald-200 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePseudo} className="flex gap-2">
          <input
            type="text"
            value={newPseudo}
            onChange={(e) => setNewPseudo(e.target.value)}
            placeholder="Nouveau pseudo"
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500/50 rounded-2xl px-4 py-2.5 text-sm text-white outline-none transition-all placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs px-4 rounded-2xl font-semibold transition-all shadow-md shadow-indigo-500/10 shrink-0 flex items-center justify-center cursor-pointer"
          >
            {loading ? "Chargement..." : "Appliquer"}
          </button>
        </form>
      </div>

      {/* Change password Interaction Block */}
      <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-900 space-y-3 shadow-xl">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Lock className="w-4.5 h-4.5 text-indigo-400" />
          Modifier mon mot de passe
        </h4>
        
        <p className="text-xs text-gray-400 leading-normal">
          Mettez à jour votre mot de passe d’accès personnel. Il doit contenir <strong>au moins 4 caractères</strong>.
        </p>

        {passwordError && (
          <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/20 text-red-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 text-emerald-200 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="flex gap-2">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nouveau mot de passe"
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500/50 rounded-2xl px-4 py-2.5 text-sm text-white outline-none transition-all placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={passwordLoading}
            className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs px-4 rounded-2xl font-semibold transition-all shadow-md shadow-indigo-500/10 shrink-0 flex items-center justify-center cursor-pointer"
          >
            {passwordLoading ? "Chargement..." : "Appliquer"}
          </button>
        </form>
      </div>

      {/* Logout Action */}
      <div className="pt-3">
        <button
          onClick={onLogout}
          className="w-full bg-slate-100 dark:bg-slate-900/40 hover:bg-red-500/10 hover:border-red-500/20 text-red-400 border border-slate-800/60 rounded-3xl py-3.5 px-4 font-semibold text-sm transition-all flex items-center justify-center gap-2.5 shadow-md"
        >
          <LogOut className="w-4.5 h-4.5" />
          Se déconnecter de la session
        </button>
      </div>

    </div>
  );
}
