# KedeAwak — spesifikasi aplikasi dan rencana pengembangan

**Status:** dokumen produk; membedakan fitur yang sudah ada dari rencana.  
**Arah produk:** aplikasi web untuk bisnis yang ingin menghubungkan nomor WhatsApp Business miliknya dengan agent AI khusus bisnis (misalnya layanan pelanggan). DeepSeek menghasilkan jawaban; WhatsApp Business Platform resmi Meta adalah arah integrasi produksi. Implementasi Fonnte saat ini tetap dipakai sebagai prototipe, bukan otomatis berubah menjadi integrasi Meta.

## 1. Masalah, pengguna, dan batasan produk

- **Masalah:** bisnis perlu membalas pertanyaan pelanggan secara cepat melalui WhatsApp, termasuk pertanyaan tentang foto, tanpa menjalankan komputer/tunnel sendiri.
- **Pengguna utama:** pemilik atau admin bisnis; pelanggan mereka hanya berinteraksi lewat WhatsApp. Operator KedeAwak mengelola layanan.
- **Nilai utama:** satu dashboard untuk menghubungkan nomor bisnis, menyesuaikan perilaku bot, memantau percakapan, dan mengambil alih percakapan saat perlu.
- **Batasan penting:** mengetik nomor saja **tidak** memberi akses WhatsApp. Pemilik harus menyelesaikan onboarding, verifikasi nomor, dan pemberian izin melalui penyedia yang dipakai. Jangan menghubungkan nomor tanpa persetujuan pemiliknya.
- **Posisi produk yang direncanakan:** agent untuk kebutuhan bisnis tertentu, bukan layanan asisten AI serbaguna bagi siapa pun. Sebelum dijual, tinjau kebijakan Meta tentang penyedia AI dan kelayakan kasus penggunaan ini.

## 2. Kondisi proyek saat ini (sudah diimplementasikan)

**Stack:** Node.js 22+, Express, `better-sqlite3`, API DeepSeek `deepseek-flash`, API dan webhook Fonnte. Kode utama berada di `index.js`, dependensi/skrip di `package.json`, petunjuk menjalankan prototipe di `README.md`, contoh konfigurasi di `.env.example`, dan tes API tiruan di `test/webhook.test.mjs` serta `support/mock-fetch.mjs`.

| Fitur prototipe | Kondisi sebenarnya |
| --- | --- |
| Balas teks pribadi | **Berfungsi dan pernah diuji melalui WhatsApp:** webhook Fonnte → DeepSeek → API kirim Fonnte. |
| Konteks percakapan | Riwayat per nomor pengirim disimpan di SQLite `memory.db`; 20 pesan terakhir dikirim ke model bersama prompt sistem tetap. `/reset` menghapus riwayat nomor tersebut. |
| Webhook | POST ke `/webhook/<WEBHOOK_SECRET>`, validasi dasar pengirim/pesan, respons HTTP 200 cepat, mengabaikan grup, log diagnostik tanpa mencetak URL gambar. Secret pada path adalah penghalang akses berbasis URL, **bukan** verifikasi tanda tangan Fonnte. |
| Foto | Kode menerima `url` dan `extension` gambar JPG/PNG/WebP, dengan/tanpa caption, kemudian mengirim `image_url` ke DeepSeek **hanya jika Fonnte memberikan URL gambar**. URL foto tidak disimpan di riwayat. Pengiriman foto sungguhan belum terverifikasi berhasil. |
| Foto pada device Fonnte Free yang dicoba | **Tidak tersedia:** webhook mengirim `non-text message` dengan `hasUrl: false`; server tidak memperoleh isi foto. Bot kini menjelaskan keterbatasan alih-alih meminta AI mengarang. Dokumentasi Fonnte menyatakan URL lampiran webhook perlu paket yang menyediakan fitur lampiran. |
| Deployment | `npm start` berjalan di komputer lokal, port 3000; Cloudflare Quick Tunnel memberi HTTPS sementara. Jika komputer atau tunnel berhenti, bot berhenti; alamat tunnel dapat berubah saat dijalankan ulang. |
| Tes | `npm test` menggunakan respons Fonnte/DeepSeek tiruan untuk alur teks, reset, gambar ber-URL, dan placeholder tanpa URL. Bukan uji koneksi Meta atau uji foto Fonnte sungguhan. |

**Yang belum ada:** akun user, multi-tenant, lebih dari satu device/token, dashboard, penyimpanan 24/7, integrasi Meta, pengelolaan penagihan, handoff manusia, dan observabilitas produksi. `FONNTE_TOKEN`/`DEEPSEEK_KEY`/`WEBHOOK_SECRET` saat ini berlaku untuk satu prototipe saja. Jangan menggunakan struktur database riwayat saat ini sebagai isolasi multi-user: indeksnya hanya `contact` (nomor pengirim).

## 3. Visi alur produksi (Meta resmi)

1. Pemilik bisnis mendaftar/login ke KedeAwak, menyetujui syarat dan kebijakan data.
2. Pemilik menghubungkan nomor **WhatsApp Business yang memenuhi persyaratan Meta** melalui proses onboarding resmi, verifikasi, dan persetujuan akses. Untuk onboarding banyak bisnis dari aplikasi sendiri, teliti terlebih dahulu persyaratan Tech Provider/Solution Partner dan Embedded Signup versi yang berlaku. Nomor WhatsApp pribadi tidak otomatis memenuhi persyaratan.
3. KedeAwak menyimpan identitas tenant/bisnis, identitas akun/nomor dari Meta, status koneksi, dan kredensial dengan aman; tidak mengandalkan nomor yang diketik sebagai bukti kepemilikan.
4. Webhook Meta diterima melalui HTTPS; tanda tangan diverifikasi; event dideduplikasi dan diarahkan berdasarkan ID akun/nomor tujuan ke tenant yang tepat.
5. Pesan pelanggan (teks atau media yang didukung) diproses sesuai konfigurasi bot tenant. Media diambil lewat mekanisme resmi yang diotorisasi, dibatasi ukuran/jenisnya, lalu dikirim ke model yang mendukungnya dengan izin dan kebijakan retensi yang jelas.
6. DeepSeek menjawab; KedeAwak memeriksa aturan keamanan, batas biaya, jam layanan, dan apakah percakapan sedang dipegang manusia; balasan dikirim lewat Cloud API. Kegagalan dapat dicoba ulang secara aman atau dialihkan ke operator.
7. Pemilik bisnis melihat status, percakapan, penggunaan, biaya, dan dapat menjeda bot atau mencabut akses kapan pun.

**Penting:** ini membutuhkan backend produksi dan perubahan integrasi, **bukan** sekadar mengganti URL Fonnte dengan URL Meta di `index.js`.

## 4. Fitur yang akan dibangun (belum diimplementasikan)

### P0 — MVP bot bisnis satu tenant pada Meta

- Integrasi WhatsApp Business Platform: akun Meta untuk pengujian, nomor yang diverifikasi, webhook masuk, verifikasi tanda tangan, pengiriman balasan, status pesan, dan pengunduhan media sesuai izin.
- Alur agent teks dan foto: pertanyaan tanpa caption mendapat instruksi default; tipe/ukuran file divalidasi; jika gambar tidak tersedia bot menjawab jujur, bukan menebak. Uji end-to-end dengan nomor sungguhan sebelum mengklaim fitur foto siap.
- Bot khusus bisnis: nama bisnis, instruksi/prompt yang bisa disunting, jam operasional, bahasa, batas panjang balasan, pesan saat AI gagal, dan sakelar aktif/nonaktif.
- Penyimpanan persisten untuk percakapan, kebijakan retensi dan `/reset`; webhook cepat dengan antrean pekerja, idempotensi, retry/backoff, serta observabilitas tanpa membocorkan token atau foto.
- Deploy selalu aktif dengan HTTPS dan database persisten, backup, monitoring/alert, serta konfigurasi rahasia di environment/secrets manager. Cloudflare Quick Tunnel hanya untuk development.
- Batas penggunaan dan pengukuran biaya per nomor/bisnis (Meta, DeepSeek, infrastruktur); pembatasan laju agar penyalahgunaan tidak menimbulkan tagihan tak terkendali.

### P1 — Aplikasi multi-bisnis (SaaS)

- Dashboard web responsif: daftar/masuk, profil bisnis, onboarding/otorisasi nomor, status koneksi, pengaturan bot, percakapan, dan statistik pemakaian.
- Multi-tenant: satu tenant memiliki satu/lebih nomor bisnis sesuai izin; pemisahan data, konfigurasi, kunci, biaya, dan riwayat berdasarkan `tenant_id` + `phone_number_id` + kontak pelanggan. Tidak boleh ada percakapan atau token yang bocor antarbisnis.
- Peran dan izin: owner/admin/agent; undangan tim, pembatasan akses, audit log, dan penghapusan/cabut koneksi oleh pemilik.
- Inbox dan handoff: lihat chat, ambil alih manual, jeda AI per percakapan, eskalasi saat AI ragu/gagal, lalu aktifkan kembali sesuai pilihan admin.
- Konten bisnis: FAQ/pengetahuan yang disetujui admin, uji coba prompt sebelum aktif, versi konfigurasi, dan batasan agar bot tidak mengarang kebijakan, harga, atau stok yang tidak diketahui.
- Paket aplikasi, kuota, peringatan pemakaian, serta administrasi biaya/penagihan bila model bisnisnya sudah ditetapkan. Jangan mengasumsikan tarif Meta tetap; tampilkan estimasi, bukan jaminan.

### P2 — Peningkatan setelah MVP tervalidasi

- Analitik kualitas jawaban, tingkat handoff, latensi, error, biaya per tenant, dan laporan berkala.
- Dukungan media/fitur tambahan **hanya jika** didukung Meta dan model yang dipilih; misalnya dokumen, audio/transkripsi, atau integrasi katalog/order. Setiap format perlu kebijakan privasi dan uji sendiri.
- Integrasi sistem bisnis (CRM, pesanan, jadwal) dengan izin terpisah, kontrol akses, dan konfirmasi manusia untuk tindakan sensitif.
- Fitur kepatuhan lanjutan: ekspor/penghapusan data, kebijakan retensi per tenant, serta evaluasi manusia terhadap jawaban bot.

## 5. Rancangan teknis awal (usulan, bukan kode yang sudah ada)

- **Frontend:** dashboard web untuk onboarding, pengaturan, inbox, dan laporan; framework dipilih saat implementasi.
- **Backend:** API aplikasi + endpoint webhook Meta; autentikasi user terpisah dari autentikasi webhook dan kredensial Meta.
- **Pekerja/antrean:** memproses pesan setelah webhook divalidasi dan di-acknowledge; kunci deduplikasi event Meta dan pengurutan per percakapan mencegah balasan dobel/salah konteks.
- **Penyimpanan:** database persisten untuk `users`, `tenants`, `memberships`, `channels/phone_numbers`, `agents`, `conversations`, `messages`, `usage_events`, dan `audit_events`. Enkripsi kredensial; media disimpan sementara hanya bila diperlukan dan dihapus sesuai retensi. Pertimbangkan database terkelola ketika trafik multi-tenant naik; SQLite lokal sekarang hanya untuk prototipe.
- **Keamanan:** HTTPS, verifikasi webhook resmi, otorisasi per tenant, enkripsi token saat disimpan, least privilege, validasi URL/media dan ukuran, pengendalian spam, backup, serta larangan memasukkan secret ke kode, Git, atau log.
- **Privasi:** informasikan bahwa pesan/foto pelanggan akan diproses oleh Meta, penyedia model AI (DeepSeek), dan infrastruktur KedeAwak; tetapkan persetujuan, tujuan pemrosesan, durasi penyimpanan, penghapusan, dan siapa yang bisa melihatnya.

## 6. Kebijakan, biaya, dan keputusan terbuka

- **Meta resmi:** bukan otomatis gratis. Per dokumentasi Meta yang ditinjau pada Oktober 2026, balasan kategori *service* terkirim ditagih per pesan sejak 1 Oktober 2026; template marketing/utility/authentication memiliki aturan serta tarif berbeda menurut pasar. Pesan masuk tidak menjadi tagihan pengiriman Meta. Biaya DeepSeek, hosting, dan kemungkinan BSP dibayar terpisah. Konfirmasi tarif dan pengecualian terkini sebelum menentukan harga aplikasi.
- **Batas 24 jam:** pesan non-template hanya dikirim dalam jendela layanan yang terbuka setelah pelanggan mengirim pesan; untuk memulai kontak di luar jendela perlu template yang disetujui dan sesuai kebijakan.
- **Kelayakan produk AI:** aturan Meta membatasi asisten AI umum yang ditawarkan penyedia pihak ketiga. Fokus pada agent untuk kebutuhan bisnis spesifik; telaah kebijakan/kelayakan dengan Meta atau mitra resmi sebelum menjualnya. Tidak ada klaim bahwa akun atau aplikasi sudah disetujui Meta.
- **Coexistence:** kemampuan memakai nomor WhatsApp Business App bersamaan dengan Cloud API memiliki persyaratan dan batasan tersendiri; validasi kelayakan tiap pelanggan, jangan berjanji semua nomor pribadi bisa langsung dipakai.
- **Keputusan produk yang belum dibuat:** target bisnis pertama, jenis tugas agent, siapa menanggung biaya pesan/API, harga paket, hosting, jumlah nomor per tenant, retensi pesan, serta cara onboarding Meta (langsung vs mitra resmi). Dokumentasikan pilihan sebelum implementasi P1.
- **Prototipe Fonnte:** setiap device punya paket/token sendiri; akun Fonnte dengan device Free tidak menyediakan URL foto yang diperlukan pada percobaan ini. Fonnte memakai integrasi tidak resmi berbasis WhatsApp Web dan bukan gateway produksi Meta resmi.

## 7. Tahapan dan kriteria selesai

1. **Bekukan dan ukur prototipe:** jaga fungsi balasan teks Fonnte, catat masalah nyata dan biaya, jangan memindahkan secret/riwayat ke repo.
2. **Validasi aturan & desain:** pastikan kasus penggunaan bot bisnis sesuai Meta, pilih jalur onboarding, buat perkiraan biaya per pesan dan kebijakan data. Hasil: keputusan go/no-go tertulis.
3. **MVP Meta satu bisnis:** siapkan nomor uji, webhook tervalidasi, teks + foto, DeepSeek, penyimpanan persisten, tes integrasi, dan operasional 24/7. Hasil: nomor yang diotorisasi benar-benar menjawab teks dan mendeskripsikan foto yang dikirim lewat WhatsApp resmi.
4. **Pilot multi-tenant terbatas:** dashboard, pemisahan tenant, beberapa nomor yang diotorisasi, kontrol biaya, inbox/handoff, dan uji akses silang. Hasil: bisnis A tidak dapat melihat/memakai data atau nomor bisnis B.
5. **Rilis bertahap:** penagihan dan dukungan operasional, monitor keamanan/biaya, backup-restorasi, prosedur gangguan, persetujuan kebijakan, dan audit sebelum membuka onboarding umum.

## Referensi keputusan

- Fonnte: [API add device](https://docs.fonnte.com/api-add-device/), [QR](https://docs.fonnte.com/api-get-qr/), [lampiran webhook](https://docs.fonnte.com/webhook-get-attachment/).
- Meta: [Embedded Signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation), [harga pesan layanan (perubahan 2026)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages.md), [kebijakan AI Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers).
- DeepSeek: [Vision API](https://api-docs.deepseek.com/guides/vision).
