import { appendFileSync } from "node:fs";

// Preload di child process: semua permintaan API eksternal diganti respons lokal.
globalThis.fetch = async (url, options) => {
  appendFileSync(process.env.MOCK_CALLS, JSON.stringify({
    url, body: String(options.body), authorization: options.headers.Authorization,
  }) + "\n");

  if (url === "https://api.deepseek.com/chat/completions") {
    return new Response(JSON.stringify({ choices: [{ message: { content: "Halo dari AI" } }] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }
  if (url === "https://api.fonnte.com/send") {
    return new Response(JSON.stringify({ status: true }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }
  throw new Error(`URL tidak dikenal: ${url}`);
};
