import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const serverFile = fileURLToPath(new URL("../index.js", import.meta.url));
const mockFile = new URL("../support/mock-fetch.mjs", import.meta.url).href;
const secret = "rahasia-panjang-untuk-test";

async function waitFor(predicate) {
  for (let i = 0; i < 100; i++) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timeout menunggu server atau balasan API");
}

test("webhook memproses chat pribadi, mengabaikan grup, dan mendukung reset", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "wa-agent-test-"));
  const callsFile = join(dir, "calls.jsonl");
  writeFileSync(callsFile, "");
  const child = spawn(process.execPath, ["--import", mockFile, serverFile], {
    cwd: dir,
    env: { ...process.env, FONNTE_TOKEN: "token-test", DEEPSEEK_KEY: "key-test",
      WEBHOOK_SECRET: secret, PORT: "0", MOCK_CALLS: callsFile },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
    rmSync(dir, { recursive: true, force: true });
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.on("error", (error) => { output += error.message; });
  const match = await waitFor(() => output.match(/Server jalan di port (\d+)/)).catch((error) => {
    throw new Error(`${error.message}: ${output}`);
  });
  const url = `http://127.0.0.1:${match[1]}`;
  const calls = () => readFileSync(callsFile, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  const post = (path, body) => fetch(`${url}${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });

  assert.equal((await fetch(url)).status, 200);
  assert.equal((await post("/webhook/salah", { sender: "628123456789", message: "Hai" })).status, 404);
  await waitFor(() => output.includes("Webhook ditolak: URL/path tidak cocok"));
  assert.equal((await post(`/webhook/${secret}`, { sender: "628123456789", message: "Hai", member: "628000000000" })).status, 200);
  await waitFor(() => output.includes("Webhook diabaikan: pesan grup"));
  assert.equal(calls().length, 0);

  assert.equal((await post(`/webhook/${secret}`, { sender: "628123456789", message: "Hai" })).status, 200);
  await waitFor(() => calls().length === 2);
  assert.ok(output.includes("Webhook diterima"));
  assert.equal(JSON.parse(calls()[0].body).model, "deepseek-flash");
  assert.deepEqual(JSON.parse(calls()[0].body).messages.at(-1), { role: "user", content: "Hai" });
  assert.equal(new URLSearchParams(calls()[1].body).get("target"), "628123456789");
  assert.equal(new URLSearchParams(calls()[1].body).get("message"), "Halo dari AI");

  assert.equal((await post(`/webhook/${secret}`, { sender: "628123456789", message: "/reset" })).status, 200);
  await waitFor(() => calls().length === 3);
  assert.equal(new URLSearchParams(calls()[2].body).get("message"), "Memori percakapan dihapus.");
  assert.equal((await post(`/webhook/${secret}`, { sender: "628123456789", message: "Lagi" })).status, 200);
  await waitFor(() => calls().length === 5);
  assert.equal(JSON.parse(calls()[3].body).messages.length, 2); // system + pesan baru

  const imageUrl = "https://example.com/foto.jpg";
  assert.equal((await post(`/webhook/${secret}`, {
    sender: "628123456789", message: "Apa isi foto ini?", url: imageUrl, extension: "jpg",
  })).status, 200);
  await waitFor(() => calls().length === 7);
  const imageRequest = JSON.parse(calls()[5].body);
  assert.deepEqual(imageRequest.messages.at(-1).content, [
    { type: "text", text: "[Gambar] Apa isi foto ini?" },
    { type: "image_url", image_url: { url: imageUrl } },
  ]);
  assert.equal(new URLSearchParams(calls()[6].body).get("message"), "Halo dari AI");

  assert.equal((await post(`/webhook/${secret}`, {
    sender: "628123456789", message: "", url: imageUrl, extension: "png",
  })).status, 200);
  await waitFor(() => calls().length === 9);
  assert.equal(JSON.parse(calls()[7].body).messages.at(-1).content[0].text,
    "[Gambar] Jelaskan gambar ini.");

  assert.equal((await post(`/webhook/${secret}`, { sender: "628123456789", message: "Ingat foto tadi?" })).status, 200);
  await waitFor(() => calls().length === 11);
  const followUp = JSON.parse(calls()[9].body);
  assert.equal(typeof followUp.messages.at(-1).content, "string");
  assert.equal(JSON.stringify(followUp).includes(imageUrl), false); // URL sementara tidak disimpan

  assert.equal((await post(`/webhook/${secret}`, {
    sender: "628123456789", message: "", url: "https://example.com/video.mp4", extension: "mp4",
  })).status, 200);
  assert.equal(calls().length, 11);

  assert.equal((await post(`/webhook/${secret}`, {
    sender: "628123456789", message: "non-text message",
  })).status, 200);
  await waitFor(() => calls().length === 12);
  assert.equal(calls()[11].url, "https://api.fonnte.com/send");
  assert.match(new URLSearchParams(calls()[11].body).get("message"), /belum mengirim gambar/);
  await waitFor(() => output.includes("Lampiran tanpa URL gambar")).catch((error) => {
    throw new Error(`${error.message}: ${output}`);
  });
});
