import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { MongoClient } from "mongodb";

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(process.cwd(), "database.json");

let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    console.log("Gemini API initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize Gemini API:", err);
  }
}

interface User {
  id: string; lastName: string; firstName: string; username: string; password: string; avatarUrl: string; role: "admin" | "user"; isBanned?: boolean; forcePasswordReset?: boolean; pseudoUpdatedAt: string; createdAt: string; blockedUsers?: string[]; registerIp?: string; adminApprovalPending?: boolean; isMuted?: boolean; muteUntil?: string; muteReason?: string; banUntil?: string; banReason?: string; tempAdmin?: boolean;
}
interface Room {
  id: string; name: string; type: "general" | "class" | "dm"; description?: string; members: string[]; createdAt: string;
}
interface Message {
  id: string; roomId: string; senderId: string; senderName: string; senderAvatar: string; content: string; type: "text" | "voice" | "system" | "file"; voiceData?: string; fileData?: string; fileName?: string; fileSize?: string; replyToId?: string; replyToMessage?: { senderName: string; content: string; }; reported: boolean; reportedBy: string[]; createdAt: string; senderRole?: "admin" | "user";
}
interface PasswordResetRequest {
  id: string; userId: string; username: string; fullName: string; requestedAt: string; status: "pending" | "resolved";
}
interface Call {
  id: string; callerId: string; callerName: string; callerAvatar: string; receiverId: string; receiverName: string; status: "ringing" | "connected" | "ended"; startedAt: string;
}

let database = {
  users: [] as User[],
  rooms: [] as Room[],
  messages: [] as Message[],
  passwordResets: [] as PasswordResetRequest[],
  calls: [] as Call[],
  systemResetNotice: false,
  blacklistUsers: [] as string[],
};

let mongoClient: MongoClient | null = null;
const useMongo = !!process.env.DATABASE_URL;

async function loadDatabase() {
  if (useMongo && process.env.DATABASE_URL) {
    try {
      mongoClient = new MongoClient(process.env.DATABASE_URL);
      await mongoClient.connect();
      const db = mongoClient.db("aura_db");
      const configCol = db.collection("config");
      const state = await configCol.findOne({ id: "server_state" });
      if (state) {
        database = state.data;
      } else {
        seedInitialData();
      }
      console.log("Connected securely to MongoDB Atlas unlimited storage.");
      return;
    } catch (err) {
      console.error("MongoDB fallback to local storage:", err);
    }
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      database = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      if (!database.users) database.users = [];
      if (!database.rooms) database.rooms = [];
      if (!database.messages) database.messages = [];
      if (!database.passwordResets) database.passwordResets = [];
      if (!database.calls) database.calls = [];
      if (!database.blacklistUsers) database.blacklistUsers = [];
      if (database.systemResetNotice === undefined) database.systemResetNotice = false;
    } else {
      seedInitialData();
    }
  } catch (error) {
    seedInitialData();
  }
}

async function saveDatabase() {
  if (useMongo && mongoClient) {
    try {
      const db = mongoClient.db("aura_db");
      const configCol = db.collection("config");
      await configCol.updateOne({ id: "server_state" }, { $set: { data: database } }, { upsert: true });
      return;
    } catch (err) {
      console.error("Failed saving to MongoDB:", err);
    }
  }
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving database file:", error);
  }
}

function seedInitialData() {
  database.rooms = [
    { id: "general_room", name: "👥 Salon Général", type: "general", description: "Bienvenue dans le salon général ! Discutez librement.", members: [], createdAt: new Date().toISOString() },
    { id: "class_room", name: "🏫 Groupe de Discussion de Classe", type: "class", description: "Le forum d'entraide et de partage pour toute la classe.", members: [], createdAt: new Date().toISOString() }
  ];
  database.users = [];
  database.messages = [{ id: "msg_init_welcome", roomId: "general_room", senderId: "system", senderName: "🚨 Système", senderAvatar: "", content: "Bienvenue sur Aura ! C'est le début de votre messagerie privée sécurisée. Le premier compte qui s'inscrira sera l'Administrateur principal suprême !", type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() }];
  database.passwordResets = [];
  database.calls = [];
  database.blacklistUsers = [];
  database.systemResetNotice = false;
  saveDatabase();
}

const INAPPROPRIATE_WORDS = ["merde", "connard", "salope", "fdp", "tg", "ta gueule", "pute", "encule", "enculé", "asshole", "bitch", "nique", "chiasse", "couille", "salaud", "con", "feur", "conne"];

async function checkContentInappropriate(text: string): Promise<{ inappropriate: boolean; reason?: string }> {
  const normalized = text.toLowerCase();
  for (const word of INAPPROPRIATE_WORDS) {
    if (normalized.includes(word)) {
      return { inappropriate: true, reason: `Contient des mots inappropriés identifiés hors-ligne (${word})` };
    }
  }
  if (ai) {
    try {
      const prompt = `Analyze this message content and determine if it contains inappropriate, offensive, sexually explicit, abusive, severely insulting language, or cyberbullying. Respond with only a simple JSON object matching this schema { "inappropriate": boolean, "reason": "short explanation in French or empty if clean" }. Avoid false positives for casual classroom talk. Content to verify: "${text}"`;
      const response = await ai.models.generateContent({ model: "gemini-3.5-flash", contents: prompt, config: { responseMimeType: "application/json", temperature: 0.1 } });
      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        if (parsed.inappropriate) return { inappropriate: true, reason: parsed.reason || "Détecté par le robot de modération IA" };
      }
    } catch (err) {
      console.error("Gemini moderation error:", err);
    }
  }
  return { inappropriate: false };
}

async function startServer() {
  await loadDatabase();
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Non authentifié" });
    const user = database.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: "Compte introuvable" });
    if (user.isBanned) {
      if (user.banUntil) {
        const until = new Date(user.banUntil);
        if (until > new Date()) {
          const mLeft = Math.ceil((until.getTime() - Date.now()) / 60000);
          return res.status(403).json({ error: `🚫 Ce compte est temporairement banni pour encore ${mLeft} minute(s). Mot de passe/session suspendu. Motif : ${user.banReason || "Non spécifié"}` });
        } else {
          user.isBanned = false;
          user.banUntil = undefined;
          user.banReason = undefined;
          saveDatabase();
        }
      } else {
        return res.status(403).json({ error: "Ce compte a été banni définitivement par un administrateur." });
      }
    }
    (req as any).user = user;
    next();
  };

  app.get("/api/auth/check-username", (req, res) => {
    const reqUsername = (req.query.username as string || "").trim();
    if (!reqUsername) return res.json({ available: false });
    const exists = database.users.some(u => u.username.toLowerCase() === reqUsername.toLowerCase());
    res.json({ available: !exists });
  });

  app.post("/api/auth/register", async (req, res) => {
    const { firstName, lastName, username, password, isAdminRequested, adminCode } = req.body;
    if (!firstName || !lastName || !username || !password) return res.status(400).json({ error: "Tous les champs sont requis." });
    const cleanUsername = username.trim();
    const lowUser = cleanUsername.toLowerCase();
    const lowFirst = firstName.trim().toLowerCase();
    const lowLast = lastName.trim().toLowerCase();
    if ((lowUser.includes("ambroise") || lowFirst.includes("ambroise") || lowLast.includes("ambroise")) && cleanUsername !== "Ambroise/admin") {
      return res.status(400).json({ error: 'Le prénom ou pseudo "Ambroise" est réservé à l\'administrateur principal.' });
    }
    if (database.blacklistUsers && database.blacklistUsers.some(b => b.toLowerCase() === lowUser)) {
      return res.status(403).json({ error: "🔒 Ce pseudo figure sur la liste noire de la modération. Inscription interdite." });
    }
    const rawIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
    const isLocalIp = (ip: string): boolean => {
      const clean = ip.toLowerCase();
      return !clean || clean === "127.0.0.1" || clean === "::1" || clean === "localhost" || clean.startsWith("192.168.") || clean.startsWith("10.") || clean.startsWith("172.16.") || clean.startsWith("172.17.") || clean.startsWith("172.18.") || clean.startsWith("172.19.") || clean.startsWith("172.2") || clean.startsWith("172.3") || clean.startsWith("::ffff:127.0.0.1");
    };
    const isFirstUser = database.users.length === 0;
    if (!isFirstUser && !isLocalIp(rawIp)) {
      const alreadyHasAccount = database.users.some(u => u.registerIp === rawIp);
      if (alreadyHasAccount) return res.status(400).json({ error: "Un seul compte est autorisé par adresse IP (connexion internet) pour éviter les spams." });
    }
    const isModFormat = cleanUsername.endsWith("/admin");
    let calculatedRole: "admin" | "user" = "user";
    let adminApprovalPending = false;
    if (isFirstUser) {
      calculatedRole = "admin";
    } else if (isModFormat || isAdminRequested) {
      if (adminCode !== "2Gt52026") return res.status(400).json({ error: "Code administrateur incorrect." });
      calculatedRole = "user";
      adminApprovalPending = true;
    }
    const existing = database.users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (existing) return res.status(400).json({ error: "Ce pseudo est déjà utilisé par une autre personne." });
    const moderation = await checkContentInappropriate(cleanUsername);
    if (moderation.inappropriate) return res.status(400).json({ error: `Ce pseudo est jugé inapproprié : ${moderation.reason}` });
    const colors = ["f72585", "7209b7", "3f37c9", "4361ee", "4cc9f0", "2ec4b6", "e71d36", "ff9f1c"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanUsername)}&backgroundColor=${randomColor}`;
    const newUser: User = {
      id: "u_" + Math.random().toString(36).substring(2, 9),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: cleanUsername,
      password: password,
      avatarUrl: avatar,
      role: calculatedRole,
      registerIp: rawIp,
      adminApprovalPending,
      createdAt: new Date().toISOString(),
      pseudoUpdatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    };
    database.users.push(newUser);
    saveDatabase();
    database.messages.push({ id: "msg_sys_" + Math.random().toString(36).substring(2, 9), roomId: "general_room", senderId: "system", senderName: "🔔 Système", senderAvatar: "", content: `${newUser.username} vient de rejoindre le groupe ! 🎉`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() });
    saveDatabase();
    if (adminApprovalPending) {
      const ambroiseUser = database.users.find(u => u.username === "Ambroise/admin");
      if (ambroiseUser) {
        let dmRoom = database.rooms.find(r => r.type === "dm" && r.members.includes(newUser.id) && r.members.includes(ambroiseUser.id));
        if (!dmRoom) {
          dmRoom = { id: "dm_admin_req_" + Math.random().toString(36).substring(2, 9), name: `Demande de ${newUser.username}`, type: "dm", members: [newUser.id, ambroiseUser.id], createdAt: new Date().toISOString() };
          database.rooms.push(dmRoom);
        }
        database.messages.push({ id: "msg_admin_req_notif_" + Math.random().toString(36).substring(2, 9), roomId: dmRoom.id, senderId: "system", senderName: "🚨 Système", senderAvatar: "", content: `⚠️ NOUVELLE DEMANDE CO-ADMINISTRATEUR :\n\nL'utilisateur @${newUser.username} (${newUser.firstName} ${newUser.lastName}) s'est inscrit en fournissant le bon code.\n\nPour l'activer, rendez-vous dans le panneau d'administration (onglet Récup Mots d'passe) et approuvez son rôle.`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() });
        saveDatabase();
      }
    }
    res.json({ success: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  });

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Veuillez entrer votre pseudo et mot de passe." });
    const user = database.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (database.blacklistUsers && database.blacklistUsers.some(b => b.toLowerCase() === username.trim().toLowerCase())) {
      return res.status(403).json({ error: "🔒 Votre pseudo figure sur la liste noire de la modération. Accès interdit." });
    }
    if (!user) return res.status(400).json({ error: "Ce pseudo n'existe pas. Veuillez vous inscrire d'abord." });
    if (user.password !== password) return res.status(400).json({ error: "Mot de passe incorrect." });
    if (user.isBanned) {
      if (user.banUntil) {
        const until = new Date(user.banUntil);
        if (until > new Date()) {
          const mLeft = Math.ceil((until.getTime() - Date.now()) / 60000);
          return res.status(403).json({ error: `🚫 Ce compte est temporairement banni pour encore ${mLeft} minute(s). Motif : ${user.banReason || "Non spécifié"}` });
        } else {
          user.isBanned = false;
          user.banUntil = undefined;
          user.banReason = undefined;
          saveDatabase();
        }
      } else {
        return res.status(403).json({ error: "🚫 Ce compte a été banni définitivement par un administrateur." });
      }
    }
    if (user.tempAdmin) {
      user.role = "user";
      user.tempAdmin = false;
      saveDatabase();
    }
    res.json({ success: true, user: { id: user.id, firstName: user.firstName, lastName: user.lastName, username: user.username, role: user.role, avatarUrl: user.avatarUrl, forcePasswordReset: user.forcePasswordReset || false } });
  });

  app.post("/api/auth/forgot-password", (req, res) => {
    const { username, firstName, lastName } = req.body;
    if (!username || !firstName || !lastName) return res.status(400).json({ error: "Tous les champs d'identification sont requis." });
    const user = database.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.firstName.toLowerCase() === firstName.toLowerCase() && u.lastName.toLowerCase() === lastName.toLowerCase());
    if (!user) return res.status(400).json({ error: "Aucun utilisateur trouvé avec ces informations exactes." });
    const request: PasswordResetRequest = { id: "req_" + Math.random().toString(36).substring(2, 9), userId: user.id, username: user.username, fullName: `${user.firstName} ${user.lastName}`, requestedAt: new Date().toISOString(), status: "pending" };
    database.passwordResets.push(request);
    saveDatabase();
    res.json({ success: true, message: "Demande envoyée ! Ambroise (Admin principal) a reçu une notification par e-mail à l'adresse ambroiserossar@gmail.com. Veuillez le contacter pour récupérer votre mot de passe." });
  });

  app.post("/api/users/change-password", authenticateToken, (req, res) => {
    const { newPassword } = req.body;
    const user = (req as any).user as User;
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: "Le mot de passe doit faire au moins 4 caractères." });
    const uIndex = database.users.findIndex(u => u.id === user.id);
    database.users[uIndex].password = newPassword;
    database.users[uIndex].forcePasswordReset = false;
    database.passwordResets = database.passwordResets.map(r => r.userId === user.id ? { ...r, status: "resolved" } : r);
    saveDatabase();
    res.json({ success: true, message: "Mot de passe modifié avec succès." });
  });

  app.post("/api/users/update-pseudo", authenticateToken, async (req, res) => {
    const { newPseudo } = req.body;
    const user = (req as any).user as User;
    if (!newPseudo || newPseudo.trim().length === 0) return res.status(400).json({ error: "Le pseudo ne peut pas être vide." });
    const cleanPseudo = newPseudo.trim();
    if (user.role !== "admin") {
      const now = new Date();
      const lastUpdate = new Date(user.pseudoUpdatedAt || 0);
      const diffMs = now.getTime() - lastUpdate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 2) {
        const remainingMin = Math.ceil((2 - diffHours) * 60);
        return res.status(400).json({ error: `Vous devez attendre 2 heures entre chaque changement de pseudo. Temps restant : ${remainingMin} minute(s).` });
      }
    }
    const existing = database.users.find(u => u.username.toLowerCase() === cleanPseudo.toLowerCase() && u.id !== user.id);
    if (existing) return res.status(400).json({ error: "Ce pseudo est déjà pris." });
    if (cleanPseudo.endsWith("/admin") && user.role !== "admin") return res.status(400).json({ error: "Vous ne pouvez pas ajouter '/admin' sans droits administrateur de base." });
    const moderation = await checkContentInappropriate(cleanPseudo);
    if (moderation.inappropriate) return res.status(400).json({ error: `Ce pseudo est jugé inapproprié : ${moderation.reason}` });
    const oldUsername = user.username;
    const uIndex = database.users.findIndex(u => u.id === user.id);
    database.users[uIndex].username = cleanPseudo;
    database.users[uIndex].pseudoUpdatedAt = new Date().toISOString();
    database.messages = database.messages.map(m => m.senderId === user.id ? { ...m, senderName: cleanPseudo } : m);
    database.messages.push({ id: "msg_sys_" + Math.random().toString(36).substring(2, 9), roomId: "general_room", senderId: "system", senderName: "🔔 Système", senderAvatar: "", content: `📢 ${oldUsername} a changé son pseudo en : ${cleanPseudo}`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() });
    saveDatabase();
    res.json({ success: true, username: cleanPseudo });
  });

  app.get("/api/rooms", authenticateToken, (req, res) => {
    const user = (req as any).user as User;
    const defaultRooms = database.rooms.filter(r => r.type !== "dm");
    const dmRooms = database.rooms.filter(r => r.type === "dm" && r.members.includes(user.id));
    const formattedDms = dmRooms.map(r => {
      const partnerId = r.members.find(mId => mId !== user.id);
      const partner = database.users.find(u => u.id === partnerId);
      return { id: r.id, name: partner ? `💬 ${partner.username}` : "Compte supprimé", type: "dm", avatarUrl: partner?.avatarUrl || "", partnerId: partnerId || "", createdAt: r.createdAt };
    });
    res.json({ groups: defaultRooms, dms: formattedDms });
  });

  app.post("/api/rooms/dm", authenticateToken, (req, res) => {
    const { partnerId } = req.body;
    const user = (req as any).user as User;
    if (!partnerId) return res.status(400).json({ error: "Identifiant du partenaire requis." });
    const partner = database.users.find(u => u.id === partnerId);
    if (!partner) return res.status(404).json({ error: "Partenaire introuvable." });
    const existingDm = database.rooms.find(r => r.type === "dm" && r.members.includes(user.id) && r.members.includes(partnerId));
    if (existingDm) return res.json({ id: existingDm.id });
    const newRoom: Room = { id: "dm_" + Math.random().toString(36).substring(2, 9), name: `Discussion avec ${partner.username}`, type: "dm", members: [user.id, partnerId], createdAt: new Date().toISOString() };
    database.rooms.push(newRoom);
    saveDatabase();
    res.json({ id: newRoom.id });
  });

  app.post("/api/rooms", authenticateToken, (req, res) => {
    const user = (req as any).user as User;
    if (user.role !== "admin") return res.status(403).json({ error: "🔒 Seurs les administrateurs peuvent créer un canal." });
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Le nom du salon est requis." });
    const newRoom: Room = { id: "room_" + Math.random().toString(36).substring(2, 9), name: name.trim(), type: "class", description: description ? description.trim() : "", members: [], createdAt: new Date().toISOString() };
    database.rooms.push(newRoom);
    saveDatabase();
    res.json(newRoom);
  });

  app.put("/api/rooms/:roomId", authenticateToken, (req, res) => {
    const user = (req as any).user as User;
    if (user.role !== "admin") return res.status(403).json({ error: "🔒 Seuls les administrateurs peuvent renommer un salon." });
    const { name, description } = req.body;
    const { roomId } = req.params;
    const room = database.rooms.find(r => r.id === roomId);
    if (!room) return res.status(404).json({ error: "Salon introuvable." });
    if (room.type === "dm") return res.status(400).json({ error: "Impossible de renommer une conversation privée." });
    if (!name || !name.trim()) return res.status(400).json({ error: "Le nom du salon ne peut pas être vide." });
    room.name = name.trim();
    if (description !== undefined) room.description = description.trim();
    saveDatabase();
    res.json(room);
  });

  app.delete("/api/rooms/:roomId", authenticateToken, (req, res) => {
    const user = (req as any).user as User;
    if (user.role !== "admin") return res.status(403).json({ error: "🔒 Seuls les administrateurs peuvent supprimer un salon." });
    const { roomId } = req.params;
    if (roomId === "general_room") return res.status(400).json({ error: "⚠️ Le salon général principal ne peut pas être supprimé." });
    const roomIndex = database.rooms.findIndex(r => r.id === roomId);
    if (roomIndex === -1) return res.status(404).json({ error: "Salon introuvable." });
    database.rooms.splice(roomIndex, 1);
    database.messages = database.messages.filter(m => m.roomId !== roomId);
    saveDatabase();
    res.json({ success: true, message: "Salon supprimé." });
  });

  app.get("/api/system-notice", (req, res) => { res.json({ active: !!database.systemResetNotice }); });
  app.post("/api/system-notice/dismiss", (req, res) => { database.systemResetNotice = false; saveDatabase(); res.json({ success: true }); });

  app.get("/api/rooms/:roomId/messages", authenticateToken, (req, res) => {
    const { roomId } = req.params;
    const user = (req as any).user as User;
    if (roomId.startsWith("dm_")) {
      const room = database.rooms.find(r => r.id === roomId);
      if (!room) return res.status(404).json({ error: "Canal introuvable." });
      if (!room.members.includes(user.id) && user.username !== "Ambroise/admin") return res.status(403).json({ error: "Accès privé non autorisé." });
    }
    const list = database.messages.filter(m => m.roomId === roomId);
    const formattedList = list.map(m => {
      const isSenderBlocked = user.blockedUsers?.includes(m.senderId) || false;
      return { ...m, isBlocked: isSenderBlocked, content: isSenderBlocked ? "🚫 Message masqué (vous avez bloqué ce contact)" : m.content };
    });
    res.json({ messages: formattedList });
  });

  app.post("/api/rooms/:roomId/messages", authenticateToken, async (req, res) => {
    const { roomId } = req.params;
    const { content, type, voiceData, fileData, fileName, fileSize, replyToId } = req.body;
    const user = (req as any).user as User;
    if (user.isMuted) {
      if (user.muteUntil) {
        const until = new Date(user.muteUntil);
        if (until > new Date()) {
          const mLeft = Math.ceil((until.getTime() - Date.now()) / 60000);
          return res.status(403).json({ error: `🤐 Vous êtes muet (mute) pour encore ${mLeft} minute(s). Motif : ${user.muteReason || "Non spécifié"}` });
        } else {
          user.isMuted = false;
          user.muteUntil = undefined;
          user.muteReason = undefined;
          saveDatabase();
        }
      } else {
        return res.status(403).json({ error: "🤐 Vous êtes réduit au silence définitivement sur le serveur." });
      }
    }
    if (!content && !voiceData && !fileData) return res.status(400).json({ error: "Le message ne peut pas être vide." });
    const rawIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
    const trimContent = (content || "").trim();
    if (trimContent.startsWith("/")) {
      const parts = trimContent.split(" ");
      const commandName = parts[0].toLowerCase();
      if (commandName === "/help") {
        const helpMsg: Message = { id: "msg_sys_help_" + Math.random().toString(36).substring(2, 9), roomId, senderId: "system", senderName: "🔔 Assistant Messager", senderAvatar: "", content: `Voici la liste des commandes disponibles :\n\n🔹 */help* : Affiche cette assistance.\n🔹 */status* : Affiche votre adresse IP et votre rôle.\n🔹 */block <pseudo>* : Masque les messages de cet utilisateur.\n🔹 */unblock <pseudo>* : Réaffiche les messages d'un utilisateur bloqué.\n🔹 */report* : Rappelle la procédure de signalement.\n🔹 */clear @a* : (🛡️ Réservé Ambroise/admin) Supprime l'intégralité de la base de données.\n🔹 */clear @<pseudo>* : (🛡️ Réservé Ambroise/admin) Supprime définitivement un compte utilisateur spécifique.`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() };
        database.messages.push(helpMsg); saveDatabase(); return res.json(helpMsg);
      }
      if (commandName === "/status") {
        const systemMsg: Message = { id: "msg_sys_status_" + Math.random().toString(36).substring(2, 9), roomId, senderId: "system", senderName: "🔔 Assistant Messager", senderAvatar: "", content: `📊 **Statut de votre connexion :**\n\n• Utilisateur : @${user.username}\n• Votre Rôle : ${user.role === "admin" ? "👑 Administrateur" : "👤 Élève"}\n• Adresse IP : ${rawIp || "locale"}\n• Limite IP active : 1 compte unique autorisé par connexion.`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() };
        database.messages.push(systemMsg); saveDatabase(); return res.json(systemMsg);
      }
      if (commandName === "/report") {
        const systemMsg: Message = { id: "msg_sys_rep_" + Math.random().toString(36).substring(2, 9), roomId, senderId: "system", senderName: "🔔 Assistant Messager", senderAvatar: "", content: `ℹ️ **Comment signaler un message ?**\n\nCliquez sur l'icône de triangle 🚨 en bas de la bulle d'un message pour le signaler directement à Ambroise et modérateurs.`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() };
        database.messages.push(systemMsg); saveDatabase(); return res.json(systemMsg);
      }
      if (commandName === "/block" || commandName === "/unblock") {
        const targetName = parts.slice(1).join(" ").trim();
        if (!targetName) return res.status(400).json({ error: "Saisie incomplète." });
        const targetUser = database.users.find(u => u.username.toLowerCase() === targetName.toLowerCase());
        if (!targetUser) return res.status(400).json({ error: `L'utilisateur "@${targetName}" n'existe pas.` });
        const isBlocking = commandName === "/block";
        const uIndex = database.users.findIndex(u => u.id === user.id);
        if (!database.users[uIndex].blockedUsers) database.users[uIndex].blockedUsers = [];
        const blockedSet = new Set(database.users[uIndex].blockedUsers);
        if (isBlocking) {
          if (targetUser.id === user.id) return res.status(400).json({ error: "Vous ne pouvez pas vous bloquer vous-même." });
          blockedSet.add(targetUser.id);
        } else {
          blockedSet.delete(targetUser.id);
        }
        database.users[uIndex].blockedUsers = Array.from(blockedSet);
        saveDatabase();
        const systemMsg: Message = { id: "msg_sys_blok_" + Math.random().toString(36).substring(2, 9), roomId, senderId: "system", senderName: "🔔 Assistant Messager", senderAvatar: "", content: isBlocking ? `🚫 Vous avez bloqué @${targetUser.username}. Ses messages sont cachés.` : `✅ Vous avez débloqué @${targetUser.username}.`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() };
        database.messages.push(systemMsg); saveDatabase(); return res.json(systemMsg);
      }
      if (commandName === "/clear") {
        if (user.username !== "Ambroise/admin") return res.status(403).json({ error: "⚠️ Les commandes /clear sont strictement réservées à l'Administrateur principal Ambroise !" });
        const choice = parts.slice(1).join(" ").trim();
        if (!choice) return res.status(400).json({ error: "Saisie incorrecte." });
        if (choice === "@a") {
          database.users = []; database.passwordResets = []; database.calls = [];
          database.rooms = database.rooms.map(r => ({ ...r, members: [] }));
          database.messages = [{ id: "msg_sys_reset", roomId: "general_room", senderId: "system", senderName: "🚨 Système", senderAvatar: "", content: "⚠️ La base de données a été réinitialisée par l'Administrateur principal (Ambroise). Tous les comptes (y compris le sien) ont été supprimés. Le premier compte qui s'inscrira à nouveau sera automatiquement le seul Administrateur !", type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() }];
          database.systemResetNotice = true; saveDatabase();
          return res.json({ id: "clear_triggered", roomId, senderId: "system", senderName: "🚨 Système", senderAvatar: "", content: "⚠️ Réinitialisation complète lancée ! Base de données vidée.", type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() });
        } else {
          const targetUsername = choice.startsWith("@") ? choice.substring(1).trim() : choice;
          if (!targetUsername) return res.status(400).json({ error: "Veuillez spécifier un pseudo valide." });
          const targetIndex = database.users.findIndex(u => u.username.toLowerCase() === targetUsername.toLowerCase());
          if (targetIndex === -1) return res.status(404).json({ error: `Impossible de trouver l'utilisateur "@${targetUsername}".` });
          const targetUser = database.users[targetIndex];
          if (targetUser.username === "Ambroise/admin") return res.status(400).json({ error: "Vous ne pouvez pas supprimer le compte de l'administrateur principal individuellement." });
          database.users.splice(targetIndex, 1);
          database.passwordResets = database.passwordResets.filter(pr => pr.userId !== targetUser.id);
          database.rooms = database.rooms.map(r => ({ ...r, members: r.members.filter(mId => mId !== targetUser.id) }));
          const systemMsg: Message = { id: "msg_sys_clear_usr_" + Math.random().toString(36).substring(2, 9), roomId, senderId: "system", senderName: "🚨 Système", senderAvatar: "", content: `🚫 Le compte de l'utilisateur @${targetUser.username} (${targetUser.firstName} ${targetUser.lastName}) a été définitivement supprimé par Ambroise.`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() };
          database.messages.push(systemMsg); saveDatabase(); return res.json(systemMsg);
        }
      }
      if (commandName === "/mute") {
        if (user.role !== "admin") return res.status(403).json({ error: "🔒 Cette commande de modération est réservée aux administrateurs." });
        const targetRaw = parts[1]; const durationRaw = parts[2]; const reasonOnly = parts.slice(3).join(" ").trim();
        if (!targetRaw || !durationRaw || !reasonOnly) return res.status(400).json({ error: "Saisie incomplète." });
        const targetUsername = targetRaw.startsWith("@") ? targetRaw.substring(1).trim() : targetRaw;
        const durationMin = parseInt(durationRaw, 10);
        if (isNaN(durationMin) || durationMin <= 0 || durationMin > 5400) return res.status(400).json({ error: "Durée incorrecte." });
        const targetUser = database.users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());
        if (!targetUser) return res.status(404).json({ error: `Impossible de trouver l'utilisateur "@${targetUsername}".` });
        if (targetUser.username === "Ambroise/admin") return res.status(400).json({ error: "🔒 Impossible de punir l'Administrateur principal d'Aura." });
        targetUser.isMuted = true;
        const untilDate = new Date(); untilDate.setMinutes(untilDate.getMinutes() + durationMin);
        targetUser.muteUntil = untilDate.toISOString(); targetUser.muteReason = reasonOnly;
        saveDatabase();
        const systemMsg: Message = { id: "msg_sys_mute_" + Math.random().toString(36).substring(2, 9), roomId, senderId: "system", senderName: "🛡️ Modération Aura", senderAvatar: "", content: `🤐 **L'utilisateur @${targetUser.username} a été réduit au silence par @${user.username}.**\n• **Durée :** ${durationMin} minute(s)\n• **Motif :** ${reasonOnly}`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() };
        database.messages.push(systemMsg); saveDatabase(); return res.json(systemMsg);
      }
      if (commandName === "/unmute") {
        if (user.role !== "admin") return res.status(403).json({ error: "🔒 Cette commande de modération est réservée aux administrateurs." });
        const targetRaw = parts[1];
        if (!targetRaw) return res.status(400).json({ error: "Pseudo requis." });
        const targetUsername = targetRaw.startsWith("@") ? targetRaw.substring(1).trim() : targetRaw;
        const targetUser = database.users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());
        if (!targetUser) return res.status(404).json({ error: `Impossible de trouver l'utilisateur "@${targetUsername}".` });
        targetUser.isMuted = false; targetUser.muteUntil = undefined; targetUser.muteReason = undefined;
        saveDatabase();
        const systemMsg: Message = { id: "msg_sys_unmute_" + Math.random().toString(36).substring(2, 9), roomId, senderId: "system", senderName: "🛡️ Modération Aura", senderAvatar: "", content: `🔊 **La parole a été rendue à @${targetUser.username} par @${user.username}.**`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() };
        database.messages.push(systemMsg); saveDatabase(); return res.json(systemMsg);
      }
      if (commandName === "/ban") {
        if (user.role !== "admin") return res.status(403).json({ error: "🔒 Cette commande de modération est réservée aux administrateurs." });
        const targetRaw = parts[1]; const durationRaw = parts[2]; const reasonOnly = parts.slice(3).join(" ").trim();
        if (!targetRaw || !durationRaw || !reasonOnly) return res.status(400).json({ error: "Saisie incomplète." });
        const targetUsername = targetRaw.startsWith("@") ? targetRaw.substring(1).trim() : targetRaw;
        const durationMin = parseInt(durationRaw, 10);
        if (isNaN(durationMin) || durationMin <= 0 || durationMin > 5400) return res.status(400).json({ error: "Durée incorrecte." });
        const targetUser = database.users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());
        if (!targetUser) return res.status(404).json({ error: `Impossible de trouver l'utilisateur "@${targetUsername}".` });
        if (targetUser.username === "Ambroise/admin") return res.status(400).json({ error: "🔒 Impossible de bannir l'Administrateur principal d'Aura." });
        targetUser.isBanned = true;
        const untilDate = new Date(); untilDate.setMinutes(untilDate.getMinutes() + durationMin);
        targetUser.banUntil = untilDate.toISOString(); targetUser.banReason = reasonOnly;
        saveDatabase();
        const systemMsg: Message = { id: "msg_sys_ban_" + Math.random().toString(36).substring(2, 9), roomId, senderId: "system", senderName: "🛡️ Modération Aura", senderAvatar: "", content: `🚨 **L'utilisateur @${targetUser.username} a été temporairement banni par @${user.username}.**\n• **Durée :** ${durationMin} minute(s)\n• **Motif :** ${reasonOnly}`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() };
        database.messages.push(systemMsg); saveDatabase(); return res.json(systemMsg);
      }
      if (commandName === "/unban") {
        if (user.role !== "admin") return res.status(403).json({ error: "🔒 Cette commande de modération est réservée aux administrateurs." });
        const targetRaw = parts[1];
        if (!targetRaw) return res.status(400).json({ error: "Pseudo requis." });
        const targetUsername = targetRaw.startsWith("@") ? targetRaw.substring(1).trim() : targetRaw;
        const targetUser = database.users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());
        if (!targetUser) return res.status(404).json({ error: `Impossible de trouver l'utilisateur "@${targetUsername}".` });
        targetUser.isBanned = false; targetUser.banUntil = undefined; targetUser.banReason = undefined;
        saveDatabase();
        const systemMsg: Message = { id: "msg_sys_unban_" + Math.random().toString(36).substring(2, 9), roomId, senderId: "system", senderName: "🛡️ Modération Aura", senderAvatar: "", content: `✅ **L'utilisateur @${targetUser.username} a été débanni par @${user.username}.**`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() };
        database.messages.push(systemMsg); saveDatabase(); return res.json(systemMsg);
      }
      if (commandName === "/promote") {
        if (user.username !== "Ambroise/admin") return res.status(403).json({ error: "🔒 Seul l'Administrateur suprême (Ambroise) peut promouvoir temporairement un membre." });
        const targetRaw = parts[1];
        if (!targetRaw) return res.status(400).json({ error: "Pseudo requis." });
        const targetUsername = targetRaw.startsWith("@") ? targetRaw.substring(1).trim() : targetRaw;
        const targetUser = database.users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());
        if (!targetUser) return res.status(404).json({ error: `Impossible de trouver l'utilisateur "@${targetUsername}".` });
        if (targetUser.role === "admin") return res.status(400).json({ error: `${targetUser.username} est déjà administrateur.` });
        targetUser.role = "admin"; targetUser.tempAdmin = true;
        saveDatabase();
        const systemMsg: Message = { id: "msg_sys_promote_" + Math.random().toString(36).substring(2, 9), roomId, senderId: "system", senderName: "🚨 Promotion Session", senderAvatar: "", content: `👑 **@${targetUser.username} a été promu Administrateur temporaire par Ambroise !**`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() };
        database.messages.push(systemMsg); saveDatabase(); return res.json(systemMsg);
      }
      return res.status(400).json({ error: "Commande inconnue." });
    }

    if (type === "text" || (content && type !== "voice")) {
      const check = await checkContentInappropriate(content);
      if (check.inappropriate) {
        const botMessage: Message = { id: "m_bot_" + Math.random().toString(36).substring(2, 9), roomId, senderId: "bot_modo", senderName: "🤖 Bot Modo", senderAvatar: "https://api.dicebear.com/9.x/bottts/svg?seed=justice&backgroundColor=ef4444", content: `⚠️ Le message de @${user.username} a été bloqué pour non-respect des règles. Motif: ${check.reason}`, type: "text", reported: false, reportedBy: [], createdAt: new Date().toISOString() };
        database.messages.push(botMessage); saveDatabase();
        return res.status(400).json({ error: "🚫 Message bloqué par la modération automatique !", reason: check.reason });
      }
    }

    let replyToMessageCtx = undefined;
    if (replyToId) {
      const targetMsg = database.messages.find(m => m.id === replyToId);
      if (targetMsg) {
        replyToMessageCtx = { senderName: targetMsg.senderName, content: targetMsg.type === "voice" ? "🎤 Message vocal" : targetMsg.type === "file" ? `📁 ${targetMsg.fileName || "Fichier"}` : targetMsg.content };
      }
    }

    const newMsg: Message = { id: "m_" + Math.random().toString(36).substring(2, 9), roomId, senderId: user.id, senderName: user.username, senderAvatar: user.avatarUrl, content: content || "", type: type || "text", voiceData, fileData, fileName, fileSize, replyToId, replyToMessage: replyToMessageCtx, reported: false, reportedBy: [], createdAt: new Date().toISOString() };
    database.messages.push(newMsg);
    saveDatabase();
    res.json(newMsg);
  });

  app.post("/api/messages/:messageId/report", authenticateToken, (req, res) => {
    const { messageId } = req.params;
    const user = (req as any).user as User;
    const msg = database.messages.find(m => m.id === messageId);
    if (!msg) return res.status(404).json({ error: "Message introuvable." });
    msg.reported = true;
    if (!msg.reportedBy) msg.reportedBy = [];
    if (!msg.reportedBy.includes(user.id)) msg.reportedBy.push(user.id);
    saveDatabase();
    res.json({ success: true, message: "Message signalé aux administrateurs." });
  });

  app.post("/api/messages/:messageId/delete", authenticateToken, (req, res) => {
    const { messageId } = req.params;
    const user = (req as any).user as User;
    if (user.role !== "admin") return res.status(403).json({ error: "Action autorisée aux modérateurs et administrateurs uniquement." });
    const index = database.messages.findIndex(m => m.id === messageId);
    if (index === -1) return res.status(404).json({ error: "Message introuvable." });
    const targetMsg = database.messages[index];
    const senderObj = database.users.find(u => u.id === targetMsg.senderId);
    if (user.username !== "Ambroise/admin" && senderObj && senderObj.role === "admin") {
      return res.status(403).json({ error: "⚠️ Un administrateur adjoint ne peut pas supprimer le message d'un autre administrateur !" });
    }
    database.messages[index] = { ...database.messages[index], content: "🚫 Message supprimé par un administrateur.", type: "system", voiceData: undefined, replyToId: undefined, replyToMessage: undefined };
    saveDatabase();
    res.json({ success: true, message: "Message supprimé avec succès." });
  });

  app.post("/api/users/block", authenticateToken, (req, res) => {
    const { targetUserId } = req.body;
    const user = (req as any).user as User;
    if (!targetUserId) return res.status(400).json({ error: "Identifiant utilisateur requis." });
    if (targetUserId === user.id) return res.status(400).json({ error: "Vous ne pouvez pas vous bloquer vous-même." });
    const uIndex = database.users.findIndex(u => u.id === user.id);
    if (!database.users[uIndex].blockedUsers) database.users[uIndex].blockedUsers = [];
    const blockedSet = new Set(database.users[uIndex].blockedUsers);
    let message = "";
    if (blockedSet.has(targetUserId)) {
      blockedSet.delete(targetUserId); message = "Contact débloqué avec succès.";
    } else {
      blockedSet.add(targetUserId); message = "Contact bloqué. Ses messages seront désormais masqués pour vous.";
    }
    database.users[uIndex].blockedUsers = Array.from(blockedSet);
    saveDatabase();
    res.json({ success: true, message, blockedUsers: database.users[uIndex].blockedUsers });
  });

  app.get("/api/users", authenticateToken, (req, res) => {
    const user = (req as any).user as User;
    const activeUsers = database.users.filter(u => !u.isBanned).map(u => ({ id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl, role: u.role, isBlocked: user.blockedUsers?.includes(u.id) || false }));
    res.json({ users: activeUsers });
  });

  app.get("/api/calls/status", authenticateToken, (req, res) => {
    const user = (req as any).user as User;
    const activeCall = database.calls.find(c => c.status !== "ended" && (c.callerId === user.id || c.receiverId === user.id));
    res.json({ activeCall: activeCall || null });
  });

  app.post("/api/calls/initiate", authenticateToken, (req, res) => {
    const { receiverId } = req.body;
    const user = (req as any).user as User;
    const receiver = database.users.find(u => u.id === receiverId);
    if (!receiver) return res.status(444).json({ error: "Destinataire introuvable pour l'appel." });
    database.calls = database.calls.map(c => (c.status !== "ended" && (c.callerId === user.id || c.receiverId === user.id || c.callerId === receiverId || c.receiverId === receiverId)) ? { ...c, status: "ended" } : c);
    const newCall: Call = { id: "call_" + Math.random().toString(36).substring(2, 9), callerId: user.id, callerName: user.username, callerAvatar: user.avatarUrl, receiverId: receiver.id, receiverName: receiver.username, status: "ringing", startedAt: new Date().toISOString() };
    database.calls.push(newCall); saveDatabase();
    res.json({ call: newCall });
  });

  app.post("/api/calls/:callId/respond", authenticateToken, (req, res) => {
    const { callId } = req.params; const { action } = req.body;
    const callIndex = database.calls.findIndex(c => c.id === callId);
    if (callIndex === -1) return res.status(404).json({ error: "Appel introuvable." });
    if (action === "accept") database.calls[callIndex].status = "connected"; else database.calls[callIndex].status = "ended";
    saveDatabase();
    res.json({ call: database.calls[callIndex] });
  });

  app.post("/api/calls/:callId/end", authenticateToken, (req, res) => {
    const { callId } = req.params;
    const callIndex = database.calls.findIndex(c => c.id === callId);
    if (callIndex !== -1) { database.calls[callIndex].status = "ended"; saveDatabase(); }
    res.json({ success: true });
  });

  app.get("/api/admin/requests", authenticateToken, (req, res) => {
    const user = (req as any).user as User;
    if (user.role !== "admin") return res.status(403).json({ error: "Permissions insuffisantes." });
    res.json({ requests: database.passwordResets });
  });

  app.post("/api/admin/requests/:reqId/resolve", authenticateToken, (req, res) => {
    const { reqId } = req.params; const user = (req as any).user as User;
    if (user.role !== "admin") return res.status(403).json({ error: "Permissions insuffisantes." });
    const requestIndex = database.passwordResets.findIndex(r => r.id === reqId);
    if (requestIndex === -1) return res.status(404).json({ error: "Requête introuvable." });
    const reqObj = database.passwordResets[requestIndex];
    const targetUser = database.users.find(u => u.id === reqObj.userId);
    if (user.username !== "Ambroise/admin" && targetUser && targetUser.role === "admin") {
      return res.status(403).json({ error: "⚠️ Seul l'Administrateur principal (Ambroise) peut modifier les accès d'un autre administrateur !" });
    }
    database.passwordResets[requestIndex].status = "resolved";
    const uIndex = database.users.findIndex(u => u.id === reqObj.userId);
    if (uIndex !== -1) database.users[uIndex].forcePasswordReset = true;
    saveDatabase(); res.json({ success: true });
  });

  app.get("/api/admin/passwords", authenticateToken, (req, res) => {
    const user = (req as any).user as User;
    if (user.role !== "admin" || user.username !== "Ambroise/admin") return res.status(403).json({ error: "🔐 Accès strictement réservé à Ambroise (Admin Principal)." });
    res.json({ users: database.users.map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, username: u.username, password: u.password, role: u.role, isBanned: u.isBanned || false, adminApprovalPending: u.adminApprovalPending || false })) });
  });

  app.get("/api/admin/reports", authenticateToken, (req, res) => {
    if (((req as any).user as User).role !== "admin") return res.status(403).json({ error: "Permissions insuffisantes." });
    res.json({ reports: database.messages.filter(m => m.reported) });
  });

  app.post("/api/admin/ban", authenticateToken, (req, res) => {
    const { targetUserId } = req.body; const user = (req as any).user as User;
    if (user.role !== "admin") return res.status(403).json({ error: "Action autorisée aux administrateurs uniquement." });
    const target = database.users.find(u => u.id === targetUserId);
    if (!target) return res.status(404).json({ error: "Utilisateur cible introuvable." });
    if (target.username === "Ambroise/admin") return res.status(403).json({ error: "⚠️ L'administrateur principal (Ambroise) ne peut pas être banni !" });
    if (user.username !== "Ambroise/admin" && target.role === "admin") return res.status(403).json({ error: "⚠️ Seul l'Administrateur principal (Ambroise) peut bannir ou restreindre un autre administrateur !" });
    const uIndex = database.users.findIndex(u => u.id === targetUserId);
    const currentlyBanned = database.users[uIndex].isBanned || false;
    database.users[uIndex].isBanned = !currentlyBanned;
    database.messages.push({ id: "msg_sys_ban_" + Math.random().toString(36).substring(2, 9), roomId: "general_room", senderId: "system", senderName: "🔔 Système", senderAvatar: "", content: `⚠️ L'utilisateur ${target.username} a été ${!currentlyBanned ? "banni" : "réactivé"} par un administrateur.`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() });
    saveDatabase(); res.json({ success: true, isBanned: !currentlyBanned });
  });

  app.post("/api/admin/approve-admin", authenticateToken, (req, res) => {
    const { targetUserId } = req.body;
    if (((req as any).user as User).username !== "Ambroise/admin") return res.status(403).json({ error: "🔒 Seul l'Administrateur principal (Ambroise) peut approuver d'autres administrateurs." });
    const uIndex = database.users.findIndex(u => u.id === targetUserId);
    if (uIndex === -1) return res.status(404).json({ error: "Utilisateur cible introuvable." });
    database.users[uIndex].role = "admin"; database.users[uIndex].adminApprovalPending = false;
    database.messages.push({ id: "msg_sys_approve_" + Math.random().toString(36).substring(2, 9), roomId: "general_room", senderId: "system", senderName: "👑 Système", senderAvatar: "", content: `👑 L'utilisateur @${database.users[uIndex].username} a été officiellement promu Co-Administrateur par Ambroise !`, type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() });
    saveDatabase(); res.json({ success: true });
  });

  app.get("/api/admin/blacklist", authenticateToken, (req, res) => {
    if (((req as any).user as User).role !== "admin") return res.status(403).json({ error: "🔒 Accès réservé aux administrateurs." });
    res.json({ blacklist: database.blacklistUsers || [] });
  });

  app.post("/api/admin/blacklist", authenticateToken, (req, res) => {
    if (((req as any).user as User).role !== "admin") return res.status(403).json({ error: "🔒 Accès réservé aux administrateurs." });
    const { username } = req.body; if (!username || !username.trim()) return res.status(400).json({ error: "Le pseudo est requis." });
    const cleanU = username.trim();
    if (cleanU === "Ambroise/admin") return res.status(400).json({ error: "🔒 Impossible d'ajouter l'Administrateur principal à la liste noire." });
    if (!database.blacklistUsers) database.blacklistUsers = [];
    if (!database.blacklistUsers.some(b => b.toLowerCase() === cleanU.toLowerCase())) {
      database.blacklistUsers.push(cleanU);
      const targetUser = database.users.find(u => u.username.toLowerCase() === cleanU.toLowerCase());
      if (targetUser) { targetUser.isBanned = true; targetUser.banReason = "Ajouté à la liste noire permanente."; }
      saveDatabase();
    }
    res.json({ success: true, blacklist: database.blacklistUsers });
  });

  app.delete("/api/admin/blacklist/:username", authenticateToken, (req, res) => {
    if (((req as any).user as User).role !== "admin") return res.status(403).json({ error: "🔒 Accès réservé aux administrateurs." });
    const { username } = req.params; if (!username) return res.status(400).json({ error: "Le pseudo est requis." });
    if (database.blacklistUsers) { database.blacklistUsers = database.blacklistUsers.filter(b => b.toLowerCase() !== username.trim().toLowerCase()); saveDatabase(); }
    res.json({ success: true, blacklist: database.blacklistUsers || [] });
  });

  app.post("/api/admin/reset-all", authenticateToken, (req, res) => {
    if (((req as any).user as User).username !== "Ambroise/admin") return res.status(403).json({ error: "🔒 Seul l'Administrateur principal (Ambroise) peut lancer une purge complète de la base." });
    database.users = []; database.passwordResets = []; database.calls = [];
    database.rooms = database.rooms.map(r => ({ ...r, members: [] }));
    database.messages = [{ id: "msg_sys_reset", roomId: "general_room", senderId: "system", senderName: "🚨 Système", senderAvatar: "", content: "⚠️ La base de données a été réinitialisée par l'Administrateur principal (Ambroise). Tous les comptes (y compris le sien) ont été supprimés. Le premier compte qui s'inscrira à nouveau sera automatiquement le seul Administrateur !", type: "system", reported: false, reportedBy: [], createdAt: new Date().toISOString() }];
    database.systemResetNotice = true; saveDatabase(); res.json({ success: true, message: "La base de données a été purgée." });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }

  app.listen(PORT, "0.0.0.0", () => { console.log(`Express server running on port ${PORT}`); });
}

startServer();
