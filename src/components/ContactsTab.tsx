import React from "react";
import { MessageSquare, ShieldAlert, Ban, ShieldCheck, CheckCircle, Check } from "lucide-react";
import { User } from "../types";

interface ContactsTabProps {
  users: User[];
  currentUserId: string;
  onStartDm: (partnerId: string) => void;
  onBlockUser: (partnerId: string) => void;
  blockedUserIds: string[];
}

export default function ContactsTab({
  users,
  currentUserId,
  onStartDm,
  onBlockUser,
  blockedUserIds = [],
}: ContactsTabProps) {
  
  // Exclude myself from the contacts list
  const filteredUsers = users.filter(u => u.id !== currentUserId);

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
      
      {/* Search Header Design */}
      <div>
        <h2 className="text-2xl font-semibold text-white tracking-tight">Membres</h2>
        <p className="text-xs text-gray-400 mt-1">
          Discutez en privé ou bloquez/débloquez des pseudos de la base de données.
        </p>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
          <p className="text-sm">Aucun autre membre enregistré dans l'application pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const isBlocked = blockedUserIds.includes(user.id);
            const isTargetAdmin = user.role === "admin";
            
            return (
              <div
                key={user.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/40 border border-slate-900 hover:border-slate-800 transition-all gap-3"
              >
                {/* User Info Block */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-11 h-11 rounded-2xl object-cover bg-slate-800 border border-slate-700"
                    />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
                  </div>
                  
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white truncate flex items-center gap-1">
                        {user.username.endsWith("/admin") ? user.username.split("/admin")[0] : user.username}
                        {isTargetAdmin && (
                          <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-[1px] w-3.5 h-3.5 shrink-0" title="Compte officiel certifié">
                            <Check className="w-2.5 h-2.5 stroke-[4.5]" />
                          </span>
                        )}
                      </span>
                      {isTargetAdmin && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wider bg-indigo-500/20 text-indigo-300">
                          👑 CERTIFIÉ
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {user.firstName} {user.lastName}
                    </p>
                  </div>
                </div>

                {/* Operations */}
                <div className="flex items-center gap-2">
                  {/* Block / Unblock CTA */}
                  <button
                    onClick={() => onBlockUser(user.id)}
                    className={`p-2 rounded-xl border transition-all text-xs flex items-center justify-center gap-1 ${
                      isBlocked
                        ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                        : "bg-slate-950/40 border-slate-800 text-gray-400 hover:text-red-400 hover:border-red-500/20"
                    }`}
                    title={isBlocked ? "Débloquer cet utilisateur" : "Bloquer cet utilisateur"}
                  >
                    <Ban className="w-4 h-4" />
                    <span className="hidden sm:inline">{isBlocked ? "Débloquer" : "Bloquer"}</span>
                  </button>

                  {/* Start DM Chat CTA */}
                  <button
                    onClick={() => onStartDm(user.id)}
                    className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center"
                    title="Envoyer un message privé"
                  >
                    <MessageSquare className="w-4.5 h-4.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
