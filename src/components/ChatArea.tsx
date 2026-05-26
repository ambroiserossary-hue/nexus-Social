import React, { useState, useEffect, useRef } from "react";
import { Send, Reply, AlertTriangle, Trash2, Mic, Square, Play, Pause, ChevronLeft, PhoneCall, Volume2, Paperclip, FileText, Download, Check, X } from "lucide-react";
import { Message } from "../types";

interface ChatAreaProps {
  roomId: string;
  roomName: string;
  roomType: "general" | "class" | "dm";
  roomAvatar?: string;
  partnerId?: string; // DM partner if roomType === "dm"
  xUserId: string;
  currentUserRole: "admin" | "user";
  onBackToList?: () => void;
  onInitiateCall?: (receiverId: string) => void;
}

const COMMANDS = [
  { name: "/help", desc: "Affiche l'assistance et les commandes", usage: "/help" },
  { name: "/status", desc: "Affiche le statut de connexion et adresse IP", usage: "/status" },
  { name: "/block", desc: "Masque les messages d'un pseudo", usage: "/block <pseudo>" },
  { name: "/unblock", desc: "Réaffiche les messages d'un pseudo", usage: "/unblock <pseudo>" },
  { name: "/report", desc: "Rappelle comment signaler un message", usage: "/report" },
  { name: "/clear @a", desc: "🛡️ Purge absolument tout (Ambroise uniquement)", usage: "/clear @a" },
  { name: "/clear @<pseudo>", desc: "🛡️ Supprime le compte d'un utilisateur (Ambroise uniquement)", usage: "/clear @<pseudo>" },
];

export default function ChatArea({
  roomId,
  roomName,
  roomType,
  roomAvatar,
  partnerId,
  xUserId,
  currentUserRole,
  onBackToList,
  onInitiateCall,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);

  // Beautiful Custom Dialog states
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Audio recording States
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<any>(null);

  // Audio Playback Tracking States
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch messages function
  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/messages`, {
        headers: { "x-user-id": xUserId },
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(data.messages || []);
        setPollingError(null);
      } else {
        setPollingError(data.error || "Erreur de synchronisation.");
      }
    } catch {
      setPollingError("Connexion au serveur perdue...");
    }
  };

  // Continuous real-time syncing of messages (polling every 2.5 seconds)
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2500);
    return () => clearInterval(interval);
  }, [roomId]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Voice recording duration timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // 2. Send text message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const messageContent = textInput.trim();
    setTextInput(""); // clean immediately for reactive typing feedback

    try {
      const response = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": xUserId,
        },
        body: JSON.stringify({
          content: messageContent,
          type: "text",
          replyToId: replyingTo?.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        alert(`La modération automatique : ${data.error || "Message bloqué"}`);
        return;
      }

      setReplyingTo(null);
      fetchMessages(); // refresh list
    } catch (err) {
      alert("Erreur réseau. Message non transmis.");
    }
  };

  // 2b. Choose and upload general files
  const handleFileUploadTrigger = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // Restrict file size to 15MB
    if (file.size > 15 * 1024 * 1024) {
      alert("⚠️ Fichier trop lourd. Limite acceptée : 15 Mo.");
      return;
    }

    setIsUploading(true);

    try {
      let formattedSize = `${(file.size / 1024).toFixed(1)} Ko`;
      if (file.size > 1024 * 1024) {
        formattedSize = `${(file.size / (1024 * 1024)).toFixed(1)} Mo`;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileBase64 = event.target?.result as string;
        if (!fileBase64) return;

        try {
          const response = await fetch(`/api/rooms/${roomId}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": xUserId,
            },
            body: JSON.stringify({
              type: "file",
              fileData: fileBase64,
              fileName: file.name,
              fileSize: formattedSize,
              content: `📁 Fichier partagé: ${file.name}`,
              replyToId: replyingTo?.id,
            }),
          });

          if (response.ok) {
            setReplyingTo(null);
            fetchMessages();
          } else {
            const errData = await response.json();
            alert(errData.error || "Impossible d'envoyer le document.");
          }
        } catch (err) {
          console.error("Failed to upload file message:", err);
          alert("Erreur de communication lors de l'envoi du fichier.");
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Reader error", err);
      alert("Impossible de lire votre fichier.");
      setIsUploading(false);
    }
  };

  // 3. Start voice recording
  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("L'acquisition microphonique n'est pas gérée par votre navigateur ou ce conteneur iframe.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        setIsRecording(false);

        // Convert Blob to base64 clear string to push to DB
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          // Extract purely data block
          const cleanBase64 = base64Audio.split(",")[1];

          // Push voice note as message
          try {
            const response = await fetch(`/api/rooms/${roomId}/messages`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-user-id": xUserId,
              },
              body: JSON.stringify({
                type: "voice",
                voiceData: cleanBase64,
                content: "[Message vocal]",
              }),
            });
            if (response.ok) {
              fetchMessages();
            } else {
              const errData = await response.json();
              alert(errData.error || "Échec d'envoi du vocal.");
            }
          } catch (err) {
            console.error("Failed to post voice note message", err);
          }
        };

        // Turn off mic stream tracks
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Veuillez accorder la permission d'accès au microphone dans votre navigateur.");
    }
  };

  // 4. Stop voice recording
  const stopVoiceRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    }
  };

  // 5. Play Voice Note Playback
  const playVoiceMessage = (id: string, base64Data: string) => {
    // If playing the same one, toggle pause
    if (playingVoiceId === id && currentAudioRef.current) {
      if (currentAudioRef.current.paused) {
        currentAudioRef.current.play();
        setPlayingVoiceId(id);
      } else {
        currentAudioRef.current.pause();
        setPlayingVoiceId(null);
      }
      return;
    }

    // Stop current playing
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }

    const audioUrl = `data:audio/webm;base64,${base64Data}`;
    const audioObj = new Audio(audioUrl);
    currentAudioRef.current = audioObj;
    setPlayingVoiceId(id);

    audioObj.play();

    audioObj.onended = () => {
      setPlayingVoiceId(null);
    };
  };

  // 6. Report message
  const handleReportMessage = async (msgId: string) => {
    try {
      const response = await fetch(`/api/messages/${msgId}/report`, {
        method: "POST",
        headers: { "x-user-id": xUserId },
      });
      if (response.ok) {
        setToast({
          message: "🚨 Message signalé. Les modérateurs d'Aura ont été notifiés sur leur tableau de bord.",
          type: "success"
        });
      } else {
        const d = await response.json();
        setToast({ message: d.error || "Impossible de signaler.", type: "error" });
      }
    } catch {
      setToast({ message: "Échec de la transmission du signalement.", type: "error" });
    }
  };

  // 7. Delete message (Admin delete)
  const executeDelete = async (msgId: string) => {
    try {
      const response = await fetch(`/api/messages/${msgId}/delete`, {
        method: "POST",
        headers: { "x-user-id": xUserId },
      });
      if (response.ok) {
        setToast({ message: "🚫 Message supprimé par la modération.", type: "success" });
        fetchMessages();
      } else {
        const d = await response.json();
        setToast({ message: d.error || "Action impossible.", type: "error" });
      }
    } catch {
      setToast({ message: "Action refusée ou serveur inaccessible.", type: "error" });
    }
    setConfirmDeleteId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#070b13] relative font-sans select-none">
      
      {/* 1. Upper Chat Header */}
      <div className="bg-slate-950/70 backdrop-blur-md px-4 py-3 border-b border-slate-900 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBackToList && (
            <button
              onClick={onBackToList}
              className="md:hidden p-1 rounded-xl hover:bg-slate-900 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5.5 h-5.5" />
            </button>
          )}

          {roomAvatar ? (
            <img
              src={roomAvatar}
              className="w-9 h-9 rounded-xl object-cover border border-slate-800"
              alt={roomName}
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xs text-indigo-300 font-bold uppercase">
              {roomName.substring(0, 2)}
            </div>
          )}

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate leading-tight flex items-center gap-1">
              {roomName.endsWith("/admin") ? roomName.split("/admin")[0] : roomName}
              {roomName.endsWith("/admin") && (
                <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-[1px] w-3.5 h-3.5 shrink-0" title="Compte officiel certifié">
                  <Check className="w-2.5 h-2.5 stroke-[4.5]" />
                </span>
              )}
            </h3>
            {pollingError ? (
              <span className="text-[10px] text-amber-500 animate-pulse font-medium block">
                {pollingError}
              </span>
            ) : (
              <span className="text-[10px] text-gray-500 font-medium block">
                {roomType === "dm" ? "Message Privé" : "Canal Public Class"}
              </span>
            )}
          </div>
        </div>

        {/* Option: Vocal calling simulation ONLY inside DMs */}
        {roomType === "dm" && partnerId && onInitiateCall && (
          <button
            onClick={() => onInitiateCall(partnerId)}
            className="p-2.5 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-600/20 hover:border-indigo-600 rounded-xl text-indigo-400 hover:text-white transition-all flex items-center justify-center shadow-inner"
            title="Passer un appel vocal de groupe ou privé"
          >
            <PhoneCall className="w-4.5 h-4.5" />
          </button>
        )}
      </div>

      {/* 2. Messages List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-4 select-text"
      >
        {messages.map((msg) => {
          const isMe = msg.senderId === xUserId;
          const isSystem = msg.type === "system";

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center py-1">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] bg-slate-950/60 text-slate-400 font-semibold border border-slate-900">
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] sm:max-w-[70%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
            >
              {/* Sender PP */}
              {!isMe && (
                <img
                  src={msg.senderAvatar}
                  alt={msg.senderName}
                  className="w-8.5 h-8.5 rounded-xl object-cover shrink-0 bg-slate-800 border border-slate-900"
                />
              )}

              <div className="space-y-1">
                {/* Sender Pseudo */}
                <span className={`text-[11px] font-bold text-gray-400 flex items-center gap-1 ${isMe ? "justify-end mr-1.5" : "ml-1.5"}`}>
                  {msg.senderName.endsWith("/admin") ? msg.senderName.split("/admin")[0] : msg.senderName}
                  {(msg.senderName.endsWith("/admin") || msg.senderRole === "admin") && (
                    <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-[1px] w-3 h-3 shrink-0" title="Compte officiel certifié">
                      <Check className="w-2 h-2 stroke-[5]" />
                    </span>
                  )}
                </span>

                {/* Message Speech bubble */}
                <div
                  className={`p-3.5 rounded-2xl border transition-all relative group ${
                    isMe
                      ? "bg-indigo-600 border-indigo-500 text-white rounded-tr-none shadow-md shadow-indigo-600/5"
                      : "bg-slate-900/40 border-slate-900 text-gray-200 rounded-tl-none"
                  }`}
                >
                  {/* Replied block header reference if present */}
                  {msg.replyToMessage && (
                    <div className="mb-2 p-2 rounded-lg bg-slate-950/40 border border-slate-900/40 text-[10px] text-gray-400 leading-normal">
                      <strong className="block text-indigo-300 text-[9px] uppercase tracking-wide flex items-center gap-1">
                        Réponse à {msg.replyToMessage.senderName.endsWith("/admin") ? msg.replyToMessage.senderName.split("/admin")[0] : msg.replyToMessage.senderName}
                        {msg.replyToMessage.senderName.endsWith("/admin") && (
                          <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-[0.5px] w-2.5 h-2.5 shrink-0">
                            <Check className="w-1.5 h-1.5 stroke-[5]" />
                          </span>
                        )} :
                      </strong>
                      <span className="truncate block font-sans">{msg.replyToMessage.content}</span>
                    </div>
                  )}

                  {/* Message main payload */}
                  {msg.type === "voice" && msg.voiceData ? (
                    <div className="flex items-center gap-3 py-1 px-1">
                      <button
                        onClick={() => playVoiceMessage(msg.id, msg.voiceData!)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                          playingVoiceId === msg.id
                            ? "bg-amber-500/15 border-amber-500 text-amber-400 animate-pulse"
                            : isMe
                              ? "bg-white/10 border-white/20 text-white"
                              : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                        }`}
                      >
                        {playingVoiceId === msg.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <span className="text-xs block font-bold tracking-wide">Message Vocal</span>
                        <span className="text-[9.5px] text-gray-400 block font-mono">🎤 Format Web Audio Rec</span>
                      </div>
                    </div>
                  ) : msg.type === "file" && msg.fileData ? (
                    <div className="flex items-center gap-3 py-1 px-1 select-none">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isMe
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-indigo-550/10 border-indigo-500/20 text-indigo-400"
                      }`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs block font-bold truncate max-w-[150px] sm:max-w-[200px]" title={msg.fileName}>
                          {msg.fileName || "Fichier partagé"}
                        </span>
                        <span className={`text-[9.5px] block font-mono ${isMe ? "text-indigo-250" : "text-gray-400"}`}>
                          {msg.fileSize || "Taille inconnue"}
                        </span>
                      </div>
                      <a
                        href={msg.fileData}
                        download={msg.fileName || "fichier"}
                        className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center border transition-all ${
                          isMe
                            ? "bg-white/10 border-white/20 hover:bg-white/20 text-white active:scale-95"
                            : "bg-slate-850 hover:bg-slate-800 border-slate-800 text-gray-200 active:scale-95"
                        }`}
                        title="Télécharger l'élément"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs break-words whitespace-pre-wrap font-sans leading-relaxed">
                      {msg.content}
                    </p>
                  )}

                  {/* Quick operational action bar visible hovering / tapping */}
                  <div className={`flex items-center gap-1.5 mt-2.5 pt-1.5 border-t border-slate-800/40 ${isMe ? "justify-end text-right" : "justify-start"}`}>
                    <span className="text-[8.5px] text-gray-500 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>

                    {/* Report action (not if me, or system) */}
                    {!isMe && (
                      <button
                        onClick={() => handleReportMessage(msg.id)}
                        className="text-gray-500 hover:text-red-400 p-0.5 rounded transition-colors"
                        title="Signaler ce message au modérateur"
                      >
                        <AlertTriangle className="w-3 h-3" />
                      </button>
                    )}

                    {/* Delete button (If currently logged in as admin) */}
                    {currentUserRole === "admin" && (
                      <button
                        onClick={() => setConfirmDeleteId(msg.id)}
                        className="text-gray-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    {/* Reply triggering */}
                    <button
                      onClick={() => setReplyingTo(msg)}
                      className="text-gray-500 hover:text-indigo-400 p-0.5 rounded transition-colors"
                      title="Répondre à ce message"
                    >
                      <Reply className="w-3 h-3" />
                    </button>
                  </div>

                </div>
              </div>
            </div>
          );
        })}

        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-500 space-y-2 select-none">
            <span className="text-[34px]">💬</span>
            <p className="text-xs font-semibold">Aucun message pour l'instant.</p>
            <p className="text-[10px]">Envoyez le tout premier message ou enregistrez une note vocale !</p>
          </div>
        )}
      </div>

      {/* 3. Reply Preview Bar */}
      {replyingTo && (
        <div className="bg-slate-950 border-t border-slate-900 px-4 py-2 flex items-center justify-between gap-2 shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span className="text-xs text-indigo-300 truncate font-sans inline-flex items-center gap-1 min-w-0">
              Réponse à <strong className="inline-flex items-center gap-1 shrink-0">{replyingTo.senderName.endsWith("/admin") ? replyingTo.senderName.split("/admin")[0] : replyingTo.senderName} {replyingTo.senderName.endsWith("/admin") && (
                <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full p-[0.5px] w-2.5 h-2.5">
                  <Check className="w-1.5 h-1.5 stroke-[5]" />
                </span>
              )}</strong> : <span className="opacity-85 font-sans italic truncate">"{replyingTo.content.substring(0, 30)}..."</span>
            </span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-500 hover:text-white text-xs font-bold leading-none p-1 shrink-0"
          >
            ❌
          </button>
        </div>
      )}

      {/* 4. Active message input bar */}
      <div className="p-3.5 bg-slate-950/80 backdrop-blur-md border-t border-slate-900 shrink-0 select-none">
        
        {/* Command Autocomplete Overlay */}
        {textInput.startsWith("/") && (
          <div className="mb-2 bg-slate-900 border border-slate-800 rounded-2xl p-2 max-h-48 overflow-y-auto space-y-1 shadow-2xl">
            <p className="text-[9px] text-indigo-400 px-2 pb-1 text-left border-b border-slate-800/80 font-bold tracking-wider uppercase">Commandes Disponibles</p>
            {COMMANDS.filter(cmd => {
              const query = textInput.toLowerCase();
              if (query === "/") return true;
              if (cmd.name.startsWith(query)) return true;
              // Keep showing matching commands even if typing their parameters
              const commandRoot = cmd.name.split(" ")[0];
              const queryRoot = query.split(" ")[0];
              return commandRoot === queryRoot;
            }).map(cmd => (
              <button
                key={cmd.name}
                type="button"
                onClick={() => {
                  if (cmd.name === "/clear @<pseudo>") {
                    setTextInput("/clear @");
                  } else {
                    setTextInput(cmd.name + " ");
                  }
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-indigo-650/35 hover:text-indigo-200 rounded-xl transition-all flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-400 shrink-0">{cmd.name}</span>
                  <span className="text-[10px] text-gray-400 truncate">{cmd.desc}</span>
                </div>
                <span className="text-[9px] text-gray-600 font-mono hidden sm:inline shrink-0">{cmd.usage}</span>
              </button>
            ))}
          </div>
        )}

        {/* Toggle recorder drawer */}
        {isRecording ? (
          <div className="flex items-center justify-between p-2 rounded-2xl bg-red-950/20 border border-red-500/20 shadow-inner">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              <span className="text-xs font-bold text-red-400 tracking-wide font-mono">
                Enregistrement ({recordingSeconds}s)
              </span>
            </div>

            <button
              onClick={stopVoiceRecording}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[11.5px] font-bold transition-all shadow shadow-red-500/10 flex items-center gap-1 shrink-0"
            >
              <Square className="w-3 h-3 fill-current" />
              Envoyer la note
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            
            {/* Record vocal trigger */}
            <button
              type="button"
              onClick={startVoiceRecording}
              className="p-3 bg-slate-900 border border-slate-800 hover:border-indigo-500/30 text-gray-400 hover:text-indigo-400 rounded-2xl transition-all flex items-center justify-center shrink-0 shadow-inner"
              title="Enregistrer un message vocal"
            >
              <Mic className="w-4.5 h-4.5" />
            </button>

            {/* Choose document/any file trigger */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleFileUploadTrigger}
              disabled={isUploading}
              className={`p-3 bg-slate-900 border border-slate-800 hover:border-indigo-500/30 text-gray-400 hover:text-indigo-400 rounded-2xl transition-all flex items-center justify-center shrink-0 shadow-inner ${
                isUploading ? "animate-pulse" : ""
              }`}
              title="Ajouter n'importe quel fichier ou document"
            >
              <Paperclip className="w-4.5 h-4.5" />
            </button>

            {/* Main input */}
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={isUploading ? "Transfert de fichier..." : "Écrivez un message ou répondez..."}
              disabled={isUploading}
              className="flex-1 bg-slate-950 border border-slate-900 focus:border-indigo-500/60 rounded-2xl px-4 py-3 text-xs text-white outline-none transition-all placeholder-gray-500 disabled:opacity-50"
            />

            {/* Send CTA */}
            <button
              type="submit"
              disabled={isUploading}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-2xl transition-all flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/10 disabled:opacity-55"
            >
              <Send className="w-4.5 h-4.5 fill-current" />
            </button>

          </form>
        )}
      </div>

      {/* Toast Alert popup overlay */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-3 ${
            toast.type === "success"
              ? "bg-emerald-950/95 border-emerald-500/30 text-emerald-300"
              : toast.type === "error"
                ? "bg-red-950/95 border-red-500/30 text-red-300"
                : "bg-slate-900/95 border-slate-700/30 text-slate-300"
          }`}>
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Overlay */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b101b] border border-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200 select-none text-left">
            <div className="flex gap-3">
              <div className="text-red-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Supprimer ce message ?</h3>
                <p className="text-xs text-gray-400 leading-normal">
                  ⚠️ Souhaitez-vous supprimer ce message définitivement ? Il sera remplacé par une notification de modération.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => executeDelete(confirmDeleteId)}
                className="bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs px-5 py-2.5 rounded-2xl font-bold transition-all shadow-md shadow-red-500/10 cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
