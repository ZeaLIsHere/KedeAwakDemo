import express from "express";
import Database from "better-sqlite3";

const { FONNTE_TOKEN, DEEPSEEK_KEY, WEBHOOK_SECRET, PORT = 3000 } = process.env;
const missing = ["FONNTE_TOKEN", "DEEPSEEK_KEY", "WEBHOOK_SECRET"]
  .filter((name) => !process.env[name]?.trim());
if (missing.length || (WEBHOOK_SECRET && WEBHOOK_SECRET.length < 16)) {
  if (missing.length) console.error(`Variabel belum terbaca: ${missing.join(", ")}.`);
  if (WEBHOOK_SECRET && WEBHOOK_SECRET.length < 16) {
    console.error("WEBHOOK_SECRET harus minimal 16 karakter.");
  }
  console.error("Isi file .env di folder proyek dan simpan sebelum menjalankan npm start.");
  process.exit(1);
}

const SYSTEM_PROMPT =
  "Kamu adalah asisten pribadi yang ramah dan ringkas. Balas dalam bahasa yang dipakai lawan bicara. Jawaban singkat, cocok untuk chat WhatsApp.";
const HISTORY_LIMIT = 20; // jumlah pesan terakhir yang dikirim ke model

// --- Memori (SQLite) ---
const db = new Database("memory.db");
db.exec(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
const saveMsg = db.prepare("INSERT INTO messages (contact, role, content) VALUES (?, ?, ?)");
const getHistory = db.prepare(
  "SELECT role, content FROM (SELECT * FROM messages WHERE contact = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC"
);
const clearHistory = db.prepare("DELETE FROM messages WHERE contact = ?");

// --- DeepSeek ---
async function askDeepSeek(contact, imageUrl) {
  const history = getHistory.all(contact, HISTORY_LIMIT);
  if (imageUrl) {
    history[history.length - 1].content = [
      { type: "text", text: history[history.length - 1].content },
      { type: "image_url", image_url: { url: imageUrl } },
    ];
  }
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-flash",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("DeepSeek tidak mengembalikan balasan teks.");
  return reply;
}

// --- Kirim lewat Fonnte ---
async function sendWhatsApp(target, message) {
  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: { Authorization: FONNTE_TOKEN },
    body: new URLSearchParams({ target, message }),
  });
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error(`Fonnte gagal: ${JSON.stringify(data)}`);
}

// --- Webhook ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function imageUrlFromWebhook({ url, extension }) {
  if (typeof url !== "string" || url.length > 8192 ||
      typeof extension !== "string" || !/^(png|jpe?g|webp)$/i.test(extension)) return null;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

// URL webhook mengandung rahasia acak agar hanya pemegang URL dapat memicu agent.
app.post(`/webhook/${WEBHOOK_SECRET}`, (req, res) => {
  console.log("Webhook diterima");
  const { sender, message, member } = req.body ?? {};
  if (member) {
    console.log("Webhook diabaikan: pesan grup");
    return res.sendStatus(200);
  }
  if (typeof sender !== "string" || !/^\d{8,20}$/.test(sender)) {
    console.log("Webhook diabaikan: pengirim tidak valid");
    return res.sendStatus(200);
  }
  const imageUrl = imageUrlFromWebhook(req.body);
  if (!imageUrl && (typeof message !== "string" || !message.trim())) {
    console.log("Webhook diabaikan: tidak ada teks atau URL gambar yang didukung");
    return res.sendStatus(200);
  }

  res.sendStatus(200); // balas cepat ke Fonnte sebelum memanggil API
  const text = typeof message === "string" ? message.trim() : "";
  if (!imageUrl && text.toLowerCase() === "non-text message") {
    console.warn("Lampiran tanpa URL gambar:", {
      hasUrl: Boolean(req.body.url),
      extension: typeof req.body.extension === "string" ? req.body.extension.slice(0, 12) : "tidak ada",
    });
  }
  console.log(`[${sender}] ${imageUrl ? "[gambar] " : ""}${text}`);
  processMessage(sender, text, imageUrl).catch((err) => console.error("Error:", err));
});

app.post(["/webhook", "/webhook/*"], (_, res) => {
  console.warn("Webhook ditolak: URL/path tidak cocok");
  res.sendStatus(404);
});

async function processMessage(sender, message, imageUrl) {
  if (!imageUrl && message.toLowerCase() === "non-text message") {
    await sendWhatsApp(sender, "Maaf, saya menerima lampiran tetapi Fonnte belum mengirim gambar yang bisa saya baca. Periksa apakah paket device mendukung lampiran webhook.");
    return;
  }
  if (!imageUrl && message.toLowerCase() === "/reset") {
    clearHistory.run(sender);
    await sendWhatsApp(sender, "Memori percakapan dihapus.");
    return;
  }

  const prompt = imageUrl
    ? `[Gambar] ${message || "Jelaskan gambar ini."}`
    : message;
  saveMsg.run(sender, "user", prompt);
  const reply = await askDeepSeek(sender, imageUrl);
  await sendWhatsApp(sender, reply);
  saveMsg.run(sender, "assistant", reply);
}

app.get("/", (_, res) => res.send("WA agent aktif"));
const server = app.listen(PORT, () => console.log(`Server jalan di port ${server.address().port}`));
