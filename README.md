# WhatsApp AI agent (Fonnte + DeepSeek)

Server ini menerima pesan teks dan foto pribadi dari webhook Fonnte, mengirimnya ke DeepSeek, lalu mengirim jawabannya melalui Fonnte. Riwayat per nomor tersimpan di SQLite (`memory.db`); kirim `/reset` untuk menghapus riwayat nomor tersebut. Grup diabaikan.

## Menjalankan di komputer sendiri

1. Pasang Node.js 22 atau lebih baru, lalu jalankan `npm install` di folder ini.
2. Salin `.env.example` menjadi `.env`. Isi `FONNTE_TOKEN` (token **device** yang terhubung), `DEEPSEEK_KEY` (API key DeepSeek), dan `WEBHOOK_SECRET` (string acak yang sulit ditebak, minimal 16 karakter). Jangan bagikan file `.env` atau unggah ke Git. Jika sebelumnya sudah ada `.env`, cukup isi file tersebut; jangan timpa dengan contoh.
3. Jalankan `npm start`. Buka `http://localhost:3000/` untuk melihat respons `WA agent aktif`.
4. Fonnte tidak dapat mengakses `localhost`: gunakan tunnel HTTPS untuk uji coba (misalnya `ngrok http 3000`, setelah memasang dan mengonfigurasi ngrok) atau deploy ke server dengan alamat HTTPS tetap. Tunnel dan server harus tetap hidup saat ingin menerima pesan.
5. Di dashboard Fonnte, buka **Device → Edit**. Aktifkan **Auto Read** dan atur URL webhook menjadi `https://alamat-publik-anda/webhook/NILAI_WEBHOOK_SECRET_ANDA` (gunakan nilai persis dari `.env`). Pastikan device tetap connected dan opsi chatbot aktif jika tersedia. Fonnte mengirim POST ke URL itu.
6. Kirim pesan dari **nomor WhatsApp lain** ke nomor device Fonnte. Lihat terminal server jika tidak ada balasan.

## Foto WhatsApp

Kirim foto JPG, PNG, atau WebP dengan atau tanpa caption dari nomor lain. Jika tidak ada caption, agent akan diminta menjelaskan gambar. URL foto hanya dikirim ke DeepSeek pada permintaan saat itu; riwayat menyimpan pertanyaan dan jawaban teks, bukan file atau URL fotonya. DeepSeek harus dapat mengakses URL foto dari Fonnte lewat internet; jika URL kedaluwarsa atau tidak dapat diakses, baca pesan `Error:` di terminal. Gambar dikirim ke layanan DeepSeek untuk dianalisis, jadi hindari foto yang tidak boleh dibagikan ke pihak ketiga.

**Syarat:** menurut [dokumentasi Fonnte](https://docs.fonnte.com/webhook-get-attachment/), field `url` dan `extension` untuk lampiran hanya tersedia pada device dengan paket *all feature*. Jika saat mengirim foto terminal mencatat `Lampiran tanpa URL gambar: { hasUrl: false, extension: 'tidak ada' }`, Fonnte hanya mengirim placeholder `non-text message`, bukan file gambar. Periksa paket device dan payload webhook Fonnte; mengganti kode saja tidak bisa mengaktifkan URL lampiran yang tidak dikirim Fonnte. Dalam kasus ini bot tidak mengirim placeholder ke DeepSeek agar tidak mengarang isi foto. Format gambar yang diterima model dijelaskan di [dokumentasi DeepSeek](https://api-docs.deepseek.com/guides/vision).

Untuk produksi, jalankan di host yang menyimpan `memory.db` secara persisten dan menyediakan HTTPS. Jangan gunakan hosting yang menghentikan proses atau menghapus disk setiap restart jika ingin riwayat tersimpan. URL webhook memuat rahasia; jangan publikasikan atau masukkan ke log publik, dan ganti secret jika URL bocor. Ini pembatasan berbasis URL, bukan verifikasi tanda tangan payload Fonnte. Batasi pemakaian/tambah verifikasi sesuai kebutuhan sebelum menerima lalu lintas besar. Setiap pesan yang diproses memakai kuota/biaya DeepSeek dan Fonnte.

## Pengujian

Jalankan `npm test` untuk pengujian lokal dengan API DeepSeek dan Fonnte palsu. Pengujian ini tidak memakai token sungguhan maupun mengirim WhatsApp. Agar mencoba integrasi sungguhan, gunakan device, token, dan webhook HTTPS milik sendiri seperti langkah di atas.
