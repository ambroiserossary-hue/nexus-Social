import React, { useState, useEffect } from "react";
import { ShieldCheck, Search, Key, Trash2, Ban, Eye, EyeOff, AlertTriangle, ShieldAlert, CheckCircle } from "lucide-react";
import { User, Message, PasswordResetRequest } from "../types";

interface AdminPanelProps {
  xUserId: string;
  currentUserUsername: string;
}

export default function AdminPanel({ xUserId, currentUserUsername }: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"passwords" | "requests" | "reports" | "blacklist">("passwords");
  const [usersWithPasswords, setUsersWithPasswords] = useState<any[]>([]);
  const [reportedMessages, setReportedMessages] = useState<Message[]>([]);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [newBlacklistUsername, setNewBlacklistUsername] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Admin Data
  const loadAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch passwords (Ambroise exclusive)
      if (currentUserUsername === "Ambroise/admin") {
        const passRes = await fetch("/api/admin/passwords", { headers: { "x-user-id": xUserId } });
        const passData = await passRes.json();
        if (passRes.ok) {
          setUsersWithPasswords(passData.users || []);
        } else {
          setError(passData.error || "Impossible de charger les mots de passe cleartext.");
        }
      }

      // 2. Fetch reset requests
      const reqRes = await fetch("/api/admin/requests", { headers: { "x-user-id": xUserId } });
      const reqData = await reqRes.json();
      if (reqRes.ok) {
        setResetRequests(reqData.requests || []);
      }

      // 3. Fetch reports
      const reportsRes = await fetch("/api/admin/reports", { headers: { "x-user-id": xUserId } });
      const reportsData = await reportsRes.json();
      if (reportsRes.ok) {
        setReportedMessages(reportsData.reports || []);
      }

      // 4. Fetch blacklist
      const blacklistRes = await fetch("/api/admin/blacklist", { headers: { "x-user-id": xUserId } });
      const blacklistData = await blacklistRes.json();
      if (blacklistRes.ok) {
        setBlacklist(blacklistData.blacklist || []);
      }
    } catch (err: any) {
      setError("Une erreur est survenue lors de la récupération des données d'administration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [activeSubTab]);

  // Handle Ban User Toggle
  const handleBanToggle = async (targetId: string, username: string) => {
    if (username === "Ambroise/admin") {
      alert("⚠️ L'admin principal (Ambroise) ne peut pas être banni !");
      return;
    }
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": xUserId,
        },
        body: JSON.stringify({ targetUserId: targetId }),
      });
      const data = await res.json();
      if (res.ok) {
        loadAdminData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Erreur lors de l'application de l'action de bannissement.");
    }
  };

  // Resolve password reset request
  const handleResolveRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/resolve`, {
        method: "POST",
        headers: { "x-user-id": xUserId },
      });
      if (res.ok) {
        alert("Demande de récupération clôturée. L'utilisateur devra changer son mot de passe lors de sa reconnexion.");
        loadAdminData();
      }
    } catch (err) {
      alert("Erreur lors de la validation.");
    }
  };

  // Delete Reported Message (Admin delete msg)
  const handleDeleteMessage = async (msgId: string) => {
    try {
      const res = await fetch(`/api/messages/${msgId}/delete`, {
        method: "POST",
        headers: { "x-user-id": xUserId },
      });
      if (res.ok) {
        alert("Message supprimé et remplacé par l'avis officiel d'administration.");
        loadAdminData();
      }
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  const handleApproveCoAdmin = async (targetId: string) => {
    try {
      const res = await fetch("/api/admin/approve-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": xUserId,
        },
        body: JSON.stringify({ targetUserId: targetId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("👑 Rôle co-administrateur approuvé et activé avec succès !");
        loadAdminData();
      } else {
        alert(data.error);
      }
    } catch {
      alert("Erreur lors de l'application de l'approbation.");
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Search filter
  const filteredUsers = usersWithPasswords.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.lastName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAmbroise = currentUserUsername === "Ambroise/admin";

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
      {/* Panel Intro */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-400" />
            Module Admin
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Gérez la sécurité générale, modérez les messages signalés et récupérez les identifiants.
          </p>
        </div>
      </div>

      {/* Reset server trigger ONLY visible to Ambroise */}
      {isAmbroise && (
        <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/20 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl select-none">
          <div className="text-left">
            <h4 className="text-xs font-bold text-red-400 tracking-wide uppercase flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Zone de Purge Critique (Database)
            </h4>
            <p className="text-[11px] text-gray-400 mt-1 leading-normal max-w-lg">
              Videz intégralement la base de données, déconnectez et supprimez tous les comptes élèves (y compris le vôtre) et réinitialisez le serveur instantanément.
            </p>
          </div>
          <button
            onClick={async () => {
              const confirm1 = window.confirm("🚨 ATTENTION : Êtes-vous certain de vouloir RÉINITIALISER INTÉGRALEMENT la base de données ? Tous les comptes (y compris le vôtre) seront effacés de manière permanente.");
              if (!confirm1) return;
              const confirm2 = window.confirm("🚨 DERNIER AVERTISSEMENT : Cette action supprimera tous les messages, canaux, fichiers et identifiants. Êtes-vous sûr à 100% ?");
              if (!confirm2) return;
              
              setLoading(true);
              try {
                const res = await fetch("/api/admin/reset-all", {
                  method: "POST",
                  headers: { "x-user-id": xUserId },
                });
                const data = await res.json();
                if (res.ok) {
                  alert("✨ La base de données a été purgée avec succès ! Le serveur a été réinitialisé. L'application va se recharger.");
                  window.location.reload();
                } else {
                  alert(data.error || "Une erreur est survenue lors du reset.");
                }
              } catch (err) {
                alert("Erreur de connexion avec le serveur.");
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full md:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-500 active:scale-[0.98] disabled:opacity-50 text-white font-extrabold rounded-xl text-xs uppercase shadow-md shadow-red-500/10 cursor-pointer transition-all shrink-0"
          >
            {loading ? "Purge en cours..." : "Purger le serveur ⚡"}
          </button>
        </div>
      )}

      {/* Sub tabs selectors inside One UI styled rounded panel */}
      <div className="flex flex-wrap p-1 bg-slate-950/60 rounded-2xl border border-slate-900 shadow-inner gap-0.5">
        <button
          onClick={() => setActiveSubTab("passwords")}
          className={`flex-1 min-w-[120px] py-2 text-xs font-semibold rounded-xl text-center transition-all cursor-pointer ${
            activeSubTab === "passwords"
              ? "bg-indigo-600 text-white shadow"
              : "text-gray-400 hover:text-white"
          }`}
        >
          🔐 Récup Mots de passe
        </button>
        <button
          onClick={() => setActiveSubTab("requests")}
          className={`flex-1 min-w-[120px] py-2 text-xs font-semibold rounded-xl text-center transition-all relative cursor-pointer ${
            activeSubTab === "requests"
              ? "bg-indigo-600 text-white shadow"
              : "text-gray-400 hover:text-white"
          }`}
        >
          ⏰ Demandes Oublis
          {resetRequests.filter(r => r.status === "pending").length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab("reports")}
          className={`flex-1 min-w-[120px] py-2 text-xs font-semibold rounded-xl text-center transition-all relative cursor-pointer ${
            activeSubTab === "reports"
              ? "bg-indigo-600 text-white shadow"
              : "text-gray-400 hover:text-white"
          }`}
        >
          🚩 Messages Signalés
          {reportedMessages.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-400 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab("blacklist")}
          className={`flex-1 min-w-[120px] py-2 text-xs font-semibold rounded-xl text-center transition-all relative cursor-pointer ${
            activeSubTab === "blacklist"
              ? "bg-indigo-600 text-white shadow"
              : "text-gray-400 hover:text-white"
          }`}
        >
          🚫 Liste Noire
          {blacklist.length > 0 && (
            <span className="absolute top-1 px-1.5 py-0.5 text-[8px] font-bold bg-slate-950 border border-slate-800 text-red-400 rounded-full right-1">
              {blacklist.length}
            </span>
          )}
        </button>
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/20 text-red-200 text-xs">
          {error}
        </div>
      )}

      {/* RENDER SUB TAB CONTENTS */}
      
      {/* PART A: Passwords Search (Only matches Ambroise/admin user) */}
      {activeSubTab === "passwords" && (
        <div className="space-y-4">
          {!isAmbroise ? (
            <div className="p-6 text-center text-sm rounded-3xl bg-slate-900/30 border border-slate-800/60 text-gray-500 space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="font-semibold text-white">🔐 Contenus cryptés hautement sécurisés</p>
              <p className="text-xs">Seul l'administrateur principal (<strong>Ambroise/admin</strong>) possède les clés pour révéler les mots de passe de la base de données.</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par pseudo ou nom..."
                  className="w-full bg-slate-950 border border-slate-900 rounded-2xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 rounded-2xl bg-slate-900/40 border border-slate-900 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white tracking-tight truncate">
                          {user.username}
                        </h4>
                        <p className="text-xs text-gray-400 truncate">
                          {user.firstName} {user.lastName}
                        </p>
                      </div>

                      {user.username !== "Ambroise/admin" && (
                        <button
                          onClick={() => handleBanToggle(user.id, user.username)}
                          className={`px-3 py-1 text-[10px] font-bold tracking-wider rounded-xl border transition-all ${
                            user.isBanned
                              ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                              : "bg-slate-950/40 border-slate-800 text-gray-400 hover:text-red-400 hover:border-red-500/20"
                          }`}
                        >
                          {user.isBanned ? "🚫 BANNI" : "✅ ACTIVER"}
                        </button>
                      )}
                    </div>

                    {/* Reveal Password Element */}
                    <div className="flex items-center justify-between bg-slate-950/80 rounded-xl px-3 py-2 border border-slate-900/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <Key className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-xs font-mono text-indigo-200 select-all truncate">
                          {showPasswords[user.id] ? user.password : "••••••••••"}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => togglePasswordVisibility(user.id)}
                        className="text-gray-400 hover:text-white transition-colors"
                        title={showPasswords[user.id] ? "Cacher le mot de passe" : "Révéler le mot de passe"}
                      >
                        {showPasswords[user.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Pending Admin Promotion Option (Only for Ambroise) */}
                    {user.adminApprovalPending && (
                      <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                        <div className="text-[11px] font-semibold text-indigo-300">
                          👑 Renseigné code admin correct.
                        </div>
                        <button
                          onClick={() => handleApproveCoAdmin(user.id)}
                          className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-[10px] uppercase shadow shadow-indigo-500/10 transition-all select-none"
                        >
                          Approuver Co-Admin
                        </button>
                      </div>
                    )}

                  </div>
                ))}

                {filteredUsers.length === 0 && (
                  <p className="text-xs text-center text-gray-500 py-4">Aucun utilisateur trouvé.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* PART B: Password Reset Pending Requests */}
      {activeSubTab === "requests" && (
        <div className="space-y-3">
          {resetRequests.length === 0 ? (
            <p className="text-xs text-center text-gray-500 py-8">Aucune demande de récupération de mot de passe en cours.</p>
          ) : (
            resetRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl bg-slate-900/40 border border-slate-900 space-y-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">DEMANDE POUR :</span>
                    <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
                      {req.username}
                    </h4>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {req.fullName}
                    </p>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                    req.status === "pending"
                      ? "bg-amber-500/10 text-amber-300"
                      : "bg-emerald-500/10 text-emerald-300"
                  }`}>
                    {req.status === "pending" ? "⏰ ATTENTE" : "✅ RESOLUE"}
                  </span>
                </div>

                {req.status === "pending" && (
                  <button
                    onClick={() => handleResolveRequest(req.id)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Valider • Forcer réinitialisation mdp
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* PART C: Reported Messages Thread Moderation (Admins can delete) */}
      {activeSubTab === "reports" && (
        <div className="space-y-3">
          {reportedMessages.length === 0 ? (
            <p className="text-xs text-center text-gray-500 py-8">Aucun message signalé par les élèves pour l'instant.</p>
          ) : (
            reportedMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 rounded-2xl bg-slate-900/40 border border-slate-900 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={msg.senderAvatar}
                      alt={msg.senderName}
                      className="w-7 h-7 rounded-lg object-cover bg-slate-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-white truncate block">
                        {msg.senderName}
                      </span>
                      <span className="text-[9px] text-gray-500 block">
                        Posté le {new Date(msg.createdAt).toLocaleString("fr-FR")}
                      </span>
                    </div>
                  </div>

                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/10 text-red-400 shrink-0 uppercase tracking-widest">
                    ⚠️ {msg.reportedBy?.length || 1} Signalement(s)
                  </span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900">
                  <p className="text-xs text-gray-300 break-words font-sans">
                    {msg.type === "voice" ? "🎤 Message vocal enregistré" : msg.content}
                  </p>
                </div>

                {/* Moderate Trigger CTA */}
                <button
                  onClick={() => handleDeleteMessage(msg.id)}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl py-2 px-3 text-xs font-bold border border-red-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer le message définitivement
                </button>

              </div>
            ))
          )}
        </div>
      )}

      {/* PART D: Blacklist management (Permanent bans) */}
      {activeSubTab === "blacklist" && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-slate-900/40 border border-slate-900 space-y-3">
            <h4 className="text-xs font-bold text-red-400 tracking-wider uppercase flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-red-500" />
              Bannir un pseudo à vie (Liste Noire)
            </h4>
            <p className="text-[11px] text-gray-400 leading-normal">
              Ajoutez un pseudo à la liste noire permanente. Toute inscription ou connexion avec ce pseudo sera immédiatement verrouillée. Si un compte existe déjà, il sera banni de manière permanente.
            </p>
            
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newBlacklistUsername.trim()) return;
                try {
                  const res = await fetch("/api/admin/blacklist", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-user-id": xUserId,
                    },
                    body: JSON.stringify({ username: newBlacklistUsername }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setBlacklist(data.blacklist || []);
                    setNewBlacklistUsername("");
                    alert(`🚫 Le pseudo @${newBlacklistUsername} a été inscrit sur la liste noire permanente !`);
                  } else {
                    alert(data.error);
                  }
                } catch {
                  alert("Impossible de joindre le serveur.");
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newBlacklistUsername}
                onChange={(e) => setNewBlacklistUsername(e.target.value)}
                placeholder="Pseudo à bannir à vie..."
                className="flex-1 bg-slate-950 border border-slate-900 focus:border-red-500/50 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all"
              />
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-500 active:scale-95 text-white font-extrabold px-5 rounded-2xl text-[10px] uppercase transition-all shadow-md shadow-red-500/10 flex items-center justify-center shrink-0 cursor-pointer"
              >
                Inscrire Noir
              </button>
            </form>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] text-red-400 font-bold tracking-widest uppercase block mb-1">
              Pseudos verrouillés à vie ({blacklist.length})
            </span>

            {blacklist.length === 0 ? (
              <p className="text-xs text-center text-gray-500 py-6">Aucun pseudo sur la liste noire permanente.</p>
            ) : (
              <div className="space-y-2">
                {blacklist.map((blockedUser) => (
                  <div
                    key={blockedUser}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/40 border border-slate-900 select-all"
                  >
                    <span className="text-xs font-semibold text-red-200 flex items-center gap-1.5 font-mono">
                      <Ban className="w-3.5 h-3.5 text-red-500" />
                      {blockedUser}
                    </span>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Retirer ${blockedUser} de la liste noire permanente ?`)) return;
                        try {
                          const res = await fetch(`/api/admin/blacklist/${encodeURIComponent(blockedUser)}`, {
                            method: "DELETE",
                            headers: { "x-user-id": xUserId },
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setBlacklist(data.blacklist || []);
                          } else {
                            alert(data.error);
                          }
                        } catch {
                          alert("Erreur réseau");
                        }
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-slate-950/60 transition-colors cursor-pointer"
                      title="Retirer de la liste noire"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
