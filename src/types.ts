export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  role: "admin" | "user";
  avatarUrl: string;
  forcePasswordReset?: boolean;
  isMuted?: boolean;
  muteUntil?: string;
  muteReason?: string;
  banUntil?: string;
  banReason?: string;
  tempAdmin?: boolean;
}

export interface Room {
  id: string;
  name: string;
  type: "general" | "class" | "dm";
  description?: string;
  avatarUrl?: string; // used for DMs
  partnerId?: string; // used for DMs
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  type: "text" | "voice" | "system" | "file";
  voiceData?: string;
  fileData?: string;
  fileName?: string;
  fileSize?: string;
  replyToId?: string;
  replyToMessage?: {
    senderName: string;
    content: string;
  };
  reported: boolean;
  reportedBy: string[];
  createdAt: string;
  isBlocked?: boolean;
}

export interface Call {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  receiverName: string;
  status: "ringing" | "connected" | "ended";
  startedAt: string;
}

export interface PasswordResetRequest {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  requestedAt: string;
  status: "pending" | "resolved";
}
