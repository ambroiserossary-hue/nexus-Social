import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Users, ShieldAlert, Phone, Clock, ChevronRight, LogOut, Hash, Lock, CheckCircle, AlertTriangle, Pencil, Plus, Check, Trash2, X } from "lucide-react";
import AuthGate from "./components/AuthGate";
import BottomNav from "./components/BottomNav";
import ContactsTab from "./components/ContactsTab";
import ProfileTab from "./components/ProfileTab";
import AdminPanel from "./components/AdminPanel";
import ChatArea from "./components/ChatArea";
import CallOverlay from "./components/CallOverlay";
import { User, Room, Call, PasswordResetRequest } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"chats" | "contacts" | "admin" | "profile">("chats");
  
  // Rooms lists
  const [groupRooms, setGroupRooms] = useState<Room[]>([]);
  const [dmRooms, setDmRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  
  // Users lists
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  
  // Call status
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  
  // Pending Password Requests Counter (for admin tab red dot badge)
  const [pendingRequests, setPendingRequests] = useState<PasswordResetRequest[]>([]);

  // Beautiful Custom Dialog states
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomModalMode, setRoomModalMode] = useState<"create" | "edit">("create");
  const [roomModalTargetId, setRoomModalTargetId] = useState<string | null>(null);
  const [roomModalName, setRoomModalName] = useState("");
  const [roomModalDesc, setRoomModalDesc] = useState("");

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState("");
  const [confirmModalText, setConfirmModalText] = useState("");
  const [confirmModalAction, setConfirmModalAction] = useState<(() => void) | null>(null);

  // Track initial load to default select the General channel
  const initRef = useRef(true);

  // Forced password reset input
  const [forcedPassword, setForcedPassword] = useState("");
  const [forcedError, setForcedError] = useState<string | null>(null);
  const [forcedSuccess, setForcedSuccess] = useState<string | null>(null);

  // Load active lists
  // Load active lists
  const loadRooms = async () => {
    if (!user) return;
    try {
      const response = await fetch("/api/rooms", {
        headers: { "x-user-id": user.id }
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 404 || response.status === 403) {
          setUser(null);
        }
        return;
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return;
      }
      const data = await response.json();
      setGroupRooms(data.groups || []);
      setDmRooms(data.dms || []);

      // Default to first general room on initial load
      if (initRef.current && data.groups?.length > 0) {
        const general = data.groups.find((r: Room) => r.type === "general") || data.groups[0];
        if (general) {
          setSelectedRoom(general);
          initRef.current = false;
        }
      }
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  };

  const loadUsersList = async () => {
    if (!user) return;
    try {
      const response = await fetch("/api/users", {
        headers: { "x-user-id": user.id }
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 404 || response.status === 403) {
          setUser(null);
        }
        return;
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return;
      }
      const data = await response.json();
      setAllUsers(data.users || []);
      
      // Find blocked list for me based on full info
      // Simple search in full DB for backup
      const me = data.users.find((u: any) => u.id === user.id);
      if (me && me.blockedUsers) {
        setBlockedUsers(me.blockedUsers);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const loadPendingRequests = async () => {
    if (!user || user.role !== "admin") return;
    try {
      const response = await fetch("/api/admin/requests", {
        headers: { "x-user-id": user.id }
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 404 || response.status === 403) {
          setUser(null);
        }
        return;
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return;
      }
      const data = await response.json();
      setPendingRequests(data.requests?.filter((r: any) => r.status === "pending") || []);
    } catch (err) {
      console.error("Failed to load pending reset requests:", err);
    }
  };

  const checkCallStatus = async () => {
    if (!user) return;
    try {
      const response = await fetch("/api/calls/status", {
        headers: { "x-user-id": user.id }
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 404 || response.status === 403) {
          setUser(null);
        }
        return;
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return;
      }
      const data = await response.json();
      setActiveCall(data.activeCall || null);
    } catch (err) {
      console.error("Failed to check call status:", err);
    }
  };

  // Run on log states
  useEffect(() => {
    if (user) {
      loadRooms();
      loadUsersList();
      checkCallStatus();
      loadPendingRequests();

      // Setup global refresh loops
      const roomsLoop = setInterval(loadRooms, 3500);
      const callLoop = setInterval(checkCallStatus, 2500);
      const usersLoop = setInterval(loadUsersList, 5000);
      const reqsLoop = setInterval(loadPendingRequests, 10000);

      return () => {
        clearInterval(roomsLoop);
        clearInterval(callLoop);
        clearInterval(usersLoop);
        clearInterval(reqsLoop);
      };
    }
  }, [user]);

  // Handle forcing a new password when requested by security
  const handleForcedPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forcedPassword.length < 4) {
      setForcedError("Veuillez choisir un mot de passe d'au moins 4 caractères.");
      return;
    }
    setForcedError(null);
    setForcedSuccess(null);
    try {
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user!.id,
        },
        body: JSON.stringify({ newPassword: forcedPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setForcedSuccess("Identifiant mis à jour avec succès ! Bienvenue à nouveau sur le messager.");
        // Mark reset state as resolved client side
        setUser(prev => prev ? { ...prev, forcePasswordReset: false } : null);
        setForcedPassword("");
      } else {
        setForcedError(data.error);
      }
    } catch (err) {
      setForcedError("Erreur lors de la modification.");
    }
  };

  // Action callbacks
  const handleStartDm = async (partnerId: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/rooms/dm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({ partnerId }),
      });
      const data = await res.json();
      if (res.ok) {
        // Find room details from dm list or construct temporary
        const partner = allUsers.find(u => u.id === partnerId);
        const targetRoom: Room = {
          id: data.id,
          name: partner ? `💬 ${partner.username}` : "Vocal Chat",
          type: "dm",
          avatarUrl: partner?.avatarUrl,
          partnerId,
        };
        setSelectedRoom(targetRoom);
        setActiveTab("chats");
      }
    } catch (err) {
      alert("Impossible de créer le salon privé.");
    }
  };

  const handleBlockUserToggle = async (targetUserId: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/users/block", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setBlockedUsers(data.blockedUsers || []);
        loadUsersList();
        alert(data.message);
      }
    } catch (err) {
      alert("Erreur réseau block action.");
    }
  };

  const handleInitiateCall = async (receiverId: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/calls/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({ receiverId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveCall(data.call);
      } else {
        alert(data.error || "Destinataire indisponible actuellement.");
      }
    } catch (err) {
      alert("Le destinataire est actuellement injoignable.");
    }
  };

  const handleRespondToCall = async (callId: string, action: "accept" | "decline") => {
    if (!user) return;
    try {
      const res = await fetch(`/api/calls/${callId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveCall(data.call);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEndCall = async (callId: string) => {
    if (!user) return;
    try {
      await fetch(`/api/calls/${callId}/end`, {
        method: "POST",
        headers: { "x-user-id": user.id },
      });
      setActiveCall(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) {
    return <AuthGate onLoginSuccess={(u) => setUser(u)} />;
  }

  // Security Gate: Forced password updates required by standard recovery workflow
  if (user.forcePasswordReset) {
    return (
      <div className="min-h-screen bg-[#070b13] text-gray-100 flex items-center justify-center p-4 relative font-sans">
        <div className="absolute top-0 right-0 p-8 w-[50%] h-[50%] bg-[#4361ee]/5 blur-[120px]" />
        
        <div className="w-full max-w-md bg-slate-900/40 border border-slate-900 backdrop-blur-3xl rounded-3xl p-6 shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-2">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Candidat Sécurité Impératif</h2>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              Votre mot de passe a été récupéré avec succès par Ambroise. Pour protéger votre compte de la classe, merci de le modifier immédiatement.
            </p>
          </div>

          {forcedError && (
            <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-200 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{forcedError}</span>
            </div>
          )}

          {forcedSuccess && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-200 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{forcedSuccess}</span>
            </div>
          )}

          <form onSubmit={handleForcedPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1 ml-1 font-semibold">Nouveau mot de passe</label>
              <input
                type="password"
                value={forcedPassword}
                onChange={(e) => setForcedPassword(e.target.value)}
                placeholder="Entrez votre mot de passe privé"
                className="w-full bg-slate-950/80 border border-slate-900 focus:border-indigo-500/60 rounded-2xl py-2.5 px-4 text-sm text-white"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-2xl text-xs tracking-wide transition-all"
            >
              Enregistrer mon mot de passe et poursuivre
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#04060b] text-gray-200 font-sans relative overflow-hidden flex">
      
      {/* Absolute Ambient lights in line with Google Gemini UI style */}
      <div className="absolute top-10 left-10 w-[400px] h-[400px] bg-gradient-to-tr from-[#3a0ca3]/20 to-[#7209b7]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-gradient-to-tr from-[#48cae4]/20 to-[#4cc9f0]/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Cross-platform layout: Sidebar (Left Menu) */}
      <div className={`w-full md:w-[380px] lg:w-[420px] h-full bg-[#070b13]/95 backdrop-blur-3xl md:border-r border-slate-900 overflow-hidden flex flex-col relative z-20 shrink-0 transition-all duration-300 ${selectedRoom ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Call handling interface overlays layer */}
        <CallOverlay
          activeCall={activeCall}
          currentUserId={user.id}
          onRespondToCall={handleRespondToCall}
          onEndCall={handleEndCall}
        />

        {/* Dynamic Navigation layout container */}
        
        {/* Standard Dashboard Tab viewports */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Tab: Discussions */}
              {activeTab === "chats" && (
                <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
                  {/* Dynamic big scroll header for One UI */}
                  <div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight shrink-0">Discuter</h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Salons de la classe et messages sécurisés de la base.
                    </p>
                  </div>

                  {/* Public Core Channels list */}
                  <div className="space-y-2 shrink-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase block">SALONS COMMUNS</span>
                      {user && user.role === "admin" && (
                        <button
                          onClick={() => {
                            setRoomModalMode("create");
                            setRoomModalTargetId(null);
                            setRoomModalName("");
                            setRoomModalDesc("");
                            setIsRoomModalOpen(true);
                          }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" /> Créer
                        </button>
                      )}
                    </div>

                    {groupRooms.map((room) => {
                      const isMainGeneral = room.id === "general_room";
                      const isSelected = selectedRoom?.id === room.id;
                      return (
                        <div
                          key={room.id}
                          className="group/item relative flex items-center w-full"
                        >
                          <button
                            onClick={() => setSelectedRoom(room)}
                            className={`w-full flex items-center justify-between p-4 rounded-3xl bg-slate-900/40 border transition-all text-left select-none ${
                              isSelected ? "border-indigo-500/40 bg-indigo-500/5" : "border-slate-900 hover:border-slate-800 hover:bg-slate-900/10"
                            }`}
                          >
                            <div className="flex items-center gap-3 pr-[80px]">
                              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold shrink-0">
                                <Hash className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-white tracking-wide truncate flex items-center gap-1.5">
                                  {room.name.endsWith("/admin") ? room.name.split("/admin")[0] : room.name}
                                  {room.name.endsWith("/admin") && (
                                    <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-[1px] w-3 h-3 text-[8px]" title="Modérateur">✓</span>
                                  )}
                                </h4>
                                <p className="text-xs text-gray-400 truncate mt-0.5">{room.description || "Aucun descriptif."}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-500 group-hover/item:translate-x-0.5 transition-transform shrink-0" />
                          </button>

                          {/* Admin controls edit/trash button overlay */}
                          {user && user.role === "admin" && (
                            <div className="absolute right-9 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity z-10 bg-slate-950/90 py-1.5 px-2 rounded-2xl border border-slate-800">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRoomModalMode("edit");
                                  setRoomModalTargetId(room.id);
                                  setRoomModalName(room.name);
                                  setRoomModalDesc(room.description || "");
                                  setIsRoomModalOpen(true);
                                }}
                                className="p-1.5 text-gray-400 hover:text-indigo-400 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                                title="Modifier le salon"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              
                              {!isMainGeneral && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmModalTitle("Supprimer le salon ?");
                                    setConfirmModalText(`⚠️ Souhaitez-vous supprimer définitivement le salon "${room.name}" ainsi que tous ses messages ?`);
                                    setConfirmModalAction(() => async () => {
                                      try {
                                        const res = await fetch(`/api/rooms/${room.id}`, {
                                          method: "DELETE",
                                          headers: { "x-user-id": user.id }
                                        });
                                        if (res.ok) {
                                          if (selectedRoom?.id === room.id) {
                                            setSelectedRoom(null);
                                          }
                                          // Reload rooms
                                          const loadRes = await fetch("/api/rooms", {
                                            headers: { "x-user-id": user.id }
                                          });
                                          const loadData = await loadRes.json();
                                          if (loadData && loadData.groups) {
                                            setGroupRooms(loadData.groups);
                                          }
                                        } else {
                                          const err = await res.json();
                                          alert(err.error || "Impossible de supprimer");
                                        }
                                      } catch (err) {
                                        alert("Erreur réseau");
                                      }
                                    });
                                    setIsConfirmModalOpen(true);
                                  }}
                                  className="p-1.5 text-red-500/80 hover:text-red-400 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                                  title="Supprimer le salon"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Direct message partners listing section */}
                  <div className="space-y-2 flex-1 flex flex-col min-h-[220px]">
                    <span className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase block mb-1">MESSAGES PRIVÉS (DMs)</span>
                    
                    {dmRooms.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-500 rounded-3xl bg-slate-900/20 border border-slate-900/40">
                        <MessageSquare className="w-6 h-6 mb-2 text-gray-600" />
                        <p className="text-xs">Aucun échange privé en cours.</p>
                        <p className="text-[10px] text-gray-500 mt-1">Allez dans "Membres" pour lancer un message privé sécurisé h24.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dmRooms.map((room) => (
                          <button
                            key={room.id}
                            onClick={() => setSelectedRoom(room)}
                            className="w-full flex items-center justify-between p-3.5 rounded-3xl bg-slate-900/40 border border-slate-900 hover:border-slate-800 transition-all select-none"
                          >
                            <div className="flex items-center gap-3">
                              {room.avatarUrl ? (
                                <img
                                  src={room.avatarUrl}
                                  alt={room.name}
                                  className="w-10 h-10 rounded-2xl object-cover bg-slate-800 border border-slate-700"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
                                  <Users className="w-5 h-5 text-cyan-400" />
                                </div>
                              )}
                              <div className="text-left">
                                <h4 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                                  {room.name.endsWith("/admin") ? room.name.split("/admin")[0] : room.name}
                                  {room.name.endsWith("/admin") && (
                                    <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-[1px] w-3 h-3 shrink-0" title="Compte officiel certifié">
                                      <Check className="w-2 h-2 stroke-[5.5]" />
                                    </span>
                                  )}
                                </h4>
                                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                                  Canal synchronisé
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Tab: Contacts Lists */}
              {activeTab === "contacts" && (
                <ContactsTab
                  users={allUsers}
                  currentUserId={user.id}
                  onStartDm={handleStartDm}
                  onBlockUser={handleBlockUserToggle}
                  blockedUserIds={blockedUsers}
                />
              )}

              {/* Tab: Profil Management & Pseudo limits */}
              {activeTab === "profile" && (
                <ProfileTab
                  user={user}
                  onLogout={() => setUser(null)}
                  onPseudoUpdated={(p) => setUser(prev => prev ? { ...prev, username: p } : null)}
                  xUserId={user.id}
                />
              )}

              {/* Tab: Super Admin Dashboard panel */}
              {activeTab === "admin" && user.role === "admin" && (
                <AdminPanel
                  xUserId={user.id}
                  currentUserUsername={user.username}
                />
              )}

        </div>

        {/* Sticky ergonomic bottom mobile controller */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdmin={user.role === "admin"}
          pendingRequestCount={pendingRequests.length}
        />
      </div>

      {/* Cross-platform layout: Main Chat Content Right Side */}
      <div className={`flex-1 h-full bg-transparent relative flex flex-col z-10 transition-all duration-300 ${!selectedRoom ? 'hidden md:flex' : 'flex'}`}>
        {selectedRoom ? (
          <ChatArea
            roomId={selectedRoom.id}
            roomName={selectedRoom.name}
            roomType={selectedRoom.type}
            roomAvatar={selectedRoom.avatarUrl}
            partnerId={selectedRoom.partnerId}
            xUserId={user.id}
            currentUserRole={user.role}
            onBackToList={() => setSelectedRoom(null)}
            onInitiateCall={handleInitiateCall}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950/20 backdrop-blur-sm h-full w-full shadow-inner">
            <MessageSquare className="w-16 h-16 text-indigo-500/20 mb-4" />
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Aura</h2>
            <p className="text-gray-400 text-sm max-w-sm">
              Sélectionnez une discussion à gauche pour démarrer ou utilisez la navigation pour trouver d'autres membres.
            </p>
          </div>
        )}
      </div>

      {/* Custom Modal for Room: Create / Edit */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b101b] border border-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200 select-none">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white">
                  {roomModalMode === "create" ? "Créer un nouveau salon" : "Modifier le salon"}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {roomModalMode === "create" ? "Configurez un salon public pour votre communauté." : "Mettez à jour le nom et la description du salon."}
                </p>
              </div>
              <button
                onClick={() => setIsRoomModalOpen(false)}
                className="p-1 rounded-xl text-gray-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!roomModalName.trim()) {
                  alert("Le nom du salon est requis.");
                  return;
                }
                try {
                  let res;
                  if (roomModalMode === "create") {
                    res = await fetch("/api/rooms", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "x-user-id": user!.id,
                      },
                      body: JSON.stringify({ name: roomModalName, description: roomModalDesc }),
                    });
                  } else {
                    res = await fetch(`/api/rooms/${roomModalTargetId}`, {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        "x-user-id": user!.id,
                      },
                      body: JSON.stringify({ name: roomModalName, description: roomModalDesc }),
                    });
                  }

                  if (res.ok) {
                    setIsRoomModalOpen(false);
                    // Reload rooms
                    const loadRes = await fetch("/api/rooms", {
                      headers: { "x-user-id": user!.id },
                    });
                    const loadData = await loadRes.json();
                    if (loadData && loadData.groups) {
                      setGroupRooms(loadData.groups);
                      // Update active room details if edited
                      if (roomModalMode === "edit" && selectedRoom?.id === roomModalTargetId) {
                        const updated = loadData.groups.find((g: any) => g.id === roomModalTargetId);
                        if (updated) setSelectedRoom(updated);
                      }
                    }
                  } else {
                    const err = await res.json();
                    alert(err.error || "Une erreur est survenue.");
                  }
                } catch {
                  alert("Impossible de joindre le serveur.");
                }
              }}
              className="space-y-4 pt-1 text-left"
            >
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Nom du salon</label>
                <input
                  type="text"
                  required
                  value={roomModalName}
                  onChange={(e) => setRoomModalName(e.target.value)}
                  placeholder="Ex: Devoirs de Math"
                  className="w-full bg-slate-950 border border-slate-900 focus:border-indigo-500/50 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Description (Optionnel)</label>
                <textarea
                  value={roomModalDesc}
                  onChange={(e) => setRoomModalDesc(e.target.value)}
                  placeholder="Ex: Entraide et partage autour des cours."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-900 focus:border-indigo-500/50 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none resize-none transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-gray-400 hover:text-white transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs px-5 py-2.5 rounded-2xl font-bold transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
                >
                  {roomModalMode === "create" ? "Créer" : "Sauvegarder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b101b] border border-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200 select-none text-left">
            <div className="flex gap-3">
              <div className="text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">{confirmModalTitle}</h3>
                <p className="text-xs text-gray-400 leading-normal">{confirmModalText}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setConfirmModalAction(null);
                }}
                className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirmModalAction) {
                    await confirmModalAction();
                  }
                  setIsConfirmModalOpen(false);
                  setConfirmModalAction(null);
                }}
                className="bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs px-5 py-2.5 rounded-2xl font-bold transition-all shadow-md shadow-red-500/10 cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
