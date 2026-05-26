import React, { useState, useEffect } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, User, Radio } from "lucide-react";

interface Call {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  receiverName: string;
  status: "ringing" | "connected" | "ended";
  startedAt: string;
}

interface CallOverlayProps {
  activeCall: Call | null;
  currentUserId: string;
  onRespondToCall: (callId: string, action: "accept" | "decline") => void;
  onEndCall: (callId: string) => void;
}

export default function CallOverlay({
  activeCall,
  currentUserId,
  onRespondToCall,
  onEndCall,
}: CallOverlayProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  // Timer effect when connected
  useEffect(() => {
    let interval: any = null;
    if (activeCall && activeCall.status === "connected") {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeCall?.status]);

  if (!activeCall) return null;

  const isCaller = activeCall.callerId === currentUserId;
  const { status, id: callId } = activeCall;

  // Format Timer
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Scenario 1: Active Call is RINGING & I am the RECEIVER (Show ringing alert dialog)
  if (status === "ringing" && !isCaller) {
    return (
      <div className="fixed inset-x-4 top-4 bg-slate-950/95 backdrop-blur-2xl border-2 border-indigo-500/40 p-4 rounded-3xl z-50 flex items-center justify-between shadow-2xl animate-bounce">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <img
              src={activeCall.callerAvatar}
              alt={activeCall.callerName}
              className="w-11 h-11 rounded-2xl bg-slate-800 object-cover border border-slate-700"
            />
            <span className="absolute -bottom-1 -right-1 p-1 bg-indigo-500 rounded-lg text-white">
              <Phone className="w-2.5 h-2.5 animate-pulse" />
            </span>
          </div>
          <div className="min-w-0">
            <h4 className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Appel Vocal entrant...</h4>
            <p className="text-sm font-bold text-white truncate">{activeCall.callerName}</p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onRespondToCall(callId, "decline")}
            className="p-2.5 bg-red-600 hover:bg-red-500 rounded-2xl text-white transition-all shadow-md active:scale-90"
            title="Refuser l'appel"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onRespondToCall(callId, "accept")}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-white transition-all shadow-md active:scale-95 animate-pulse"
            title="Décrocher"
          >
            <Phone className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Scenario 2: Active Call is RINGING & I am the CALLER (Show full view of calling)
  if (status === "ringing" && isCaller) {
    return (
      <div className="fixed inset-0 bg-[#060a12]/95 backdrop-blur-2xl z-50 flex flex-col justify-between p-6 text-center select-none">
        <div className="w-[100px] h-[100px] mx-auto opacity-10 blur-[40px] bg-indigo-500 rounded-full absolute top-[30%] left-[50%] translate-x-[-50%] animate-ping" />
        
        <div className="mt-20 space-y-4">
          <div className="relative inline-block mx-auto">
            <div className="w-24 h-24 rounded-3xl bg-indigo-500/10 flex items-center justify-center border-2 border-indigo-500/40 shadow-xl shadow-indigo-500/5 animate-pulse">
              <User className="w-12 h-12 text-indigo-300" />
            </div>
            <div className="absolute inset-0 rounded-3xl border border-indigo-500 animate-ping opacity-25" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">{activeCall.receiverName}</h3>
            <p className="text-sm text-indigo-400 font-medium tracking-wide animate-pulse mt-1">Appel en cours...</p>
          </div>
        </div>

        <div className="mb-12 space-y-6">
          <p className="text-xs text-gray-500">
            L'appel retentit sur le terminal de votre correspondant en temps réel.
          </p>

          <button
            onClick={() => onEndCall(callId)}
            className="p-4 bg-red-600 hover:bg-red-500 rounded-full text-white mx-auto transition-all shadow-xl shadow-red-500/20 active:scale-95"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    );
  }

  // Scenario 3: Connected Call session (For both caller and receiver)
  if (status === "connected") {
    return (
      <div className="fixed inset-0 bg-[#060a12]/98 backdrop-blur-2xl z-50 flex flex-col justify-between p-6 text-center select-none">
        
        {/* Animated Digital Sound Wave Indicators */}
        <div className="absolute inset-x-0 top-[25%] flex justify-center items-center gap-1 opacity-20">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-indigo-400 animate-pulse"
              style={{
                height: `${24 + Math.sin(i * 1.5) * 50}px`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: "0.8s"
              }}
            />
          ))}
        </div>

        <div className="mt-16 space-y-3 relative z-10">
          <h4 className="text-[10px] font-bold text-indigo-400 tracking-widest uppercase flex items-center justify-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            Appel Vocaux Connecté
          </h4>
          
          <h3 className="text-2xl font-bold text-white tracking-tight">
            {isCaller ? activeCall.receiverName : activeCall.callerName}
          </h3>
          
          <p className="text-lg font-mono text-indigo-200 font-semibold tracking-wide bg-slate-900/40 inline-block px-3.5 py-1 rounded-full border border-slate-900 shadow-inner">
            {formatTime(duration)}
          </p>
        </div>

        {/* Floating Call dashboard controls */}
        <div className="mb-12 space-y-8 relative z-10">
          <div className="flex justify-center items-center gap-6">
            
            {/* Mute CTA Button */}
            <button
              onClick={() => setIsMuted(prev => !prev)}
              className={`p-3.5 rounded-2xl border transition-all ${
                isMuted
                  ? "bg-amber-600 border-amber-500 text-white shadow-lg"
                  : "bg-slate-900 border-slate-800 text-gray-300 hover:bg-slate-800"
              }`}
              title={isMuted ? "Activer le micro" : "Couper le micro"}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Mute Speaking Indicator bubble */}
            <div className="text-xs text-gray-400 w-24">
              {isMuted ? (
                <span className="text-amber-400 font-medium">Micro coupé</span>
              ) : (
                <span className="text-emerald-400 font-medium">En ligne</span>
              )}
            </div>

            {/* Audio volume display button */}
            <button className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-gray-300">
              <Volume2 className="w-5 h-5" />
            </button>

          </div>

          {/* End Call red button */}
          <button
            onClick={() => onEndCall(callId)}
            className="p-4 bg-red-600 hover:bg-red-500 rounded-full text-white mx-auto transition-all shadow-xl shadow-red-500/25 active:scale-95 flex items-center justify-center"
            title="Terminer la communication"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>

      </div>
    );
  }

  return null;
}
