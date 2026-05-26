import React from "react";
import { MessageSquare, Users, ShieldAlert, User } from "lucide-react";

interface BottomNavProps {
  activeTab: "chats" | "contacts" | "admin" | "profile";
  setActiveTab: (tab: "chats" | "contacts" | "admin" | "profile") => void;
  isAdmin: boolean;
  pendingRequestCount?: number;
}

export default function BottomNav({ activeTab, setActiveTab, isAdmin, pendingRequestCount = 0 }: BottomNavProps) {
  return (
    <div className="bg-slate-950/80 backdrop-blur-xl border-t border-slate-900 px-6 py-2.5 flex justify-around items-center shrink-0 z-30 relative select-none">
      
      {/* 1. Chats Tab */}
      <button
        onClick={() => setActiveTab("chats")}
        className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-2xl transition-all relative ${
          activeTab === "chats"
            ? "text-indigo-400 font-semibold"
            : "text-gray-400 hover:text-white"
        }`}
      >
        <div className={`p-1 rounded-xl transition-all ${activeTab === "chats" ? "bg-indigo-500/10" : ""}`}>
          <MessageSquare className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-wide font-sans">Discuter</span>
      </button>

      {/* 2. Contacts Tab */}
      <button
        onClick={() => setActiveTab("contacts")}
        className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-2xl transition-all relative ${
          activeTab === "contacts"
            ? "text-indigo-400 font-semibold"
            : "text-gray-400 hover:text-white"
        }`}
      >
        <div className={`p-1 rounded-xl transition-all ${activeTab === "contacts" ? "bg-indigo-500/10" : ""}`}>
          <Users className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-wide font-sans">Membres</span>
      </button>

      {/* 3. Admin Board (Only if user has roles="admin") */}
      {isAdmin && (
        <button
          onClick={() => setActiveTab("admin")}
          className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-2xl transition-all relative ${
            activeTab === "admin"
              ? "text-indigo-400 font-semibold"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <div className={`p-1 rounded-xl transition-all relative ${activeTab === "admin" ? "bg-indigo-500/10" : ""}`}>
            <ShieldAlert className="w-5 h-5" />
            {pendingRequestCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            )}
          </div>
          <span className="text-[10px] tracking-wide font-sans">Administration</span>
        </button>
      )}

      {/* 4. Profile Tab */}
      <button
        onClick={() => setActiveTab("profile")}
        className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-2xl transition-all relative ${
          activeTab === "profile"
            ? "text-indigo-400 font-semibold"
            : "text-gray-400 hover:text-white"
        }`}
      >
        <div className={`p-1 rounded-xl transition-all ${activeTab === "profile" ? "bg-indigo-500/10" : ""}`}>
          <User className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-wide font-sans">Mon Profil</span>
      </button>

    </div>
  );
}
