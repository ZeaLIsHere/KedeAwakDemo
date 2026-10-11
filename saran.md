# Saran pengembangan KedeAwak

Dokumen ini berisi **rekomendasi**, bukan daftar fitur yang sudah tersedia. Rincian kondisi proyek dan seluruh rencana fitur ada di [`apps.md`](apps.md). Saat ini KedeAwak masih prototipe satu nomor: webhook Fonnte → DeepSeek → balasan WhatsApp sudah berjalan untuk teks. Belum ada integrasi Meta, dashboard, maupun pemisahan data antarbisnis. Pada device Fonnte Free yang diuji, foto masuk tanpa URL gambar, sehingga bot belum bisa melihatnya.

## Rekomendasi utama: mulai kecil, tetapi bangun fondasi yang benar

**Bangun dulu MVP untuk satu bisnis dengan WhatsApp Business Platform resmi Meta, bukan langsung aplikasi yang menerima nomor dari banyak pengguna.** Ini memberi kesempatan menguji kebutuhan pelanggan, kualitas jawaban, ongkos, dan operasional sebelum menambah risiko onboarding serta isolasi data banyak bisnis. Fonnte tetap berguna untuk eksperimen teks, tetapi jangan menjanjikan foto atau ketersediaan produksi berdasarkan prototipe Fonnte Free.

Sebelum menulis integrasi Meta, pilih **satu jenis bisnis dan satu pekerjaan bot** yang jelas, misalnya menjawab FAQ toko. Target awal sebaiknya membantu staf menjawab pertanyaan berulang, bukan menjanjikan semua pertanyaan atau transaksi dapat ditangani otomatis. Siapkan jalur eskalasi ke manusia untuk harga, stok, komplain, dan pertanyaan yang tidak didukung data bisnis.

## Urutan kerja yang disarankan

### 1. Validasi produk dan kelayakan (sebelum migrasi)

- Wawancarai beberapa calon pemilik bisnis: pertanyaan yang paling sering masuk, jam sibuk, cara mereka menangani komplain, dan apakah mereka bersedia membayar untuk respons yang lebih cepat. Pilih satu calon bisnis untuk pilot dengan persetujuan eksplisit.
- Tentukan batas tugas bot dan sumber jawaban yang dapat dipercaya: FAQ, kebijakan toko, jam buka, kontak staf. Jika informasi tidak ada, bot harus mengaku tidak tahu dan menawarkan bantuan manusia; jangan mengarang harga atau stok.
- Verifikasi persyaratan Meta untuk nomor dan onboarding bisnis yang akan dipakai, kebijakan penyedia AI, aturan percakapan dan template, serta biaya yang berlaku saat akan diluncurkan. Nomor yang diketik pengguna **bukan** bukti kepemilikan atau izin akses. Jika kelayakan kasus penggunaan belum jelas, jangan menjual fitur onboarding otomatis.
- Hitung perkiraan biaya pilot per pesan: pengiriman Meta (sesuai kategori/negara/ketentuan terkini), pemakaian DeepSeek, hosting, penyimpanan, dan layanan pihak ketiga bila dipakai. Tetapkan batas pengeluaran bulanan dan apa yang terjadi jika batas tercapai. Hindari menjanjikan layanan gratis sebelum biaya riil diketahui.

**Hasil tahap ini:** satu kasus penggunaan, satu bisnis pilot, sumber FAQ, cara eskalasi, serta keputusan tertulis apakah jalur Meta layak dilanjutkan.

### 2. MVP Meta untuk satu bisnis

- Buat integrasi Cloud API resmi: nomor uji yang diotorisasi, verifikasi dan validasi webhook sesuai dokumentasi Meta, penerimaan pesan, serta pengiriman balasan. Jangan sekadar mengganti alamat API Fonnte di `index.js`.
- Proses webhook secara tahan gangguan: validasi event lalu respons cepat; simpan identitas event untuk mencegah balasan ganda; teruskan pekerjaan ke antrean/pekerja yang dapat mencoba ulang secara aman. Kode saat ini mengirim HTTP 200 sebelum `processMessage` selesai: bila proses berhenti setelah itu, pesan bisa hilang tanpa retry dari pengirim webhook. Untuk percakapan yang sama, jaga urutan pemrosesan agar riwayat dan balasan tidak tertukar.
- Sediakan pengaturan minimum per bisnis: instruksi bot, FAQ yang disetujui, jam operasional, pesan fallback, sakelar jeda bot, dan cara menghubungi operator. Sebelum ada dashboard, pengaturan ini boleh dikelola secara internal, asalkan tidak diubah lewat kode setiap kali bisnis memperbarui FAQ.
- Tambahkan dukungan foto **setelah** alur teks Meta stabil: unduh media melalui mekanisme resmi dengan otorisasi, periksa tipe dan ukuran, batasi masa simpan, lalu uji end-to-end bahwa model benar-benar bisa membaca gambar. Tampilkan fallback jujur jika pengunduhan atau analisis gagal. Foto tidak dapat dipulihkan dari payload Fonnte Free yang hanya berisi `non-text message`.
- Deploy ke layanan HTTPS dengan URL tetap, proses yang selalu tersedia, database persisten, backup yang pernah diuji pemulihannya, serta monitoring kegagalan webhook/kirim pesan. Cloudflare Quick Tunnel dan SQLite di disk sementara tidak memadai untuk target 24 jam.

**Kriteria selesai:** bisnis pilot yang benar-benar memiliki/otorisasi nomor dapat mengirim dan menerima teks melalui Meta; balasan tidak dobel saat webhook dikirim ulang; kegagalan API terlihat dan bisa ditangani; bot bisa dijeda. Klaim “bisa membaca foto” hanya setelah uji dengan foto WhatsApp sungguhan berhasil.

### 3. Uji pilot sebelum membuka akses umum

- Uji skenario nyata: FAQ yang tersedia/tidak tersedia, pesan bertubi-tubi, webhook duplikat, API model lambat/down, media tidak valid, dan pelanggan yang meminta staf manusia.
- Ukur setiap minggu: persentase pesan yang terjawab, tingkat eskalasi, kesalahan jawaban yang diperiksa manusia, waktu respons, pesan gagal/duplikat, dan biaya per percakapan. Tinjau contoh jawaban dengan izin yang sesuai; jangan membuat metrik kualitas hanya dari klaim model.
- Tetapkan ambang keberhasilan bersama bisnis pilot (misalnya proporsi FAQ yang selesai tanpa koreksi) berdasarkan kondisi mereka, bukan angka pemasaran yang belum terbukti.

**Hasil tahap ini:** bukti bahwa bot membantu pekerjaan nyata dan biaya operasionalnya dapat dipertanggungjawabkan. Jika hasilnya buruk, perbaiki sumber pengetahuan, prompt, atau handoff sebelum menambah fitur.

### 4. Baru kemudian jadikan aplikasi multi-bisnis

- Pilih jalur onboarding resmi yang tersedia untuk model bisnis KedeAwak; periksa persyaratan Meta/mitra untuk Embedded Signup, verifikasi kepemilikan, dan pencabutan akses. Jangan menawarkan “cukup masukkan nomor WhatsApp” sebagai cara mengaktifkan bot.
- Bangun akun, peran owner/admin/agent, dashboard pengaturan, inbox dengan handoff, dan pemisahan `tenant_id` + ID nomor tujuan pada setiap pesan, riwayat, konfigurasi, pemakaian, serta izin akses. Database sekarang mengindeks riwayat hanya dengan `contact`, sehingga **tidak boleh** dipakai apa adanya untuk beberapa bisnis: satu pelanggan yang menghubungi dua bisnis berisiko berbagi konteks.
- Tambahkan kuota per tenant, audit perubahan, ekspor/penghapusan data, serta tampilan biaya yang membedakan perkiraan dan tagihan sebenarnya. Uji secara otomatis bahwa pengguna bisnis A tidak bisa membaca atau mengirim pesan menggunakan data/nomor bisnis B.

**Kriteria selesai:** dua bisnis pilot dapat menjalankan bot secara bersamaan tanpa kebocoran percakapan, token, pengaturan, atau biaya; masing-masing dapat menjeda dan mencabut aksesnya sendiri.

## Hal teknis yang sebaiknya tidak ditunda saat menuju produksi

1. **Privasi dan keamanan:** sekarang webhook Fonnte dijaga oleh secret di URL, bukan tanda tangan payload; integrasi Meta harus memvalidasi permintaan dengan mekanisme resminya. Jangan menulis token, URL rahasia, isi foto, atau teks pelanggan ke log produksi tanpa alasan dan kontrol akses. `index.js` saat ini mencetak nomor dan teks masuk, sehingga kebijakan log perlu diubah sebelum menyimpan data pelanggan pilot. Tetapkan retensi, prosedur hapus data, dan pemberitahuan bahwa pesan diproses oleh penyedia AI.
2. **Media tidak tepercaya:** validasi ekstensi saja tidak cukup. Hindari mengambil URL dari payload sembarang secara bebas; untuk Meta gunakan API media resmi dan periksa tipe, ukuran, batas waktu, serta lokasi unduhan. Ini juga mencegah risiko mengakses alamat internal server melalui URL berbahaya.
3. **Keandalan dan biaya:** batasi panjang pesan, jumlah permintaan, riwayat yang dikirim ke model, dan anggaran per bisnis. Siapkan timeout, retry dengan backoff untuk kegagalan sementara, deduplikasi, serta notifikasi ketika layanan terganggu atau biaya mendekati batas. Balasan gagal harus bisa ditangani staf, bukan hilang diam-diam.
4. **Pengujian:** pertahankan `npm test` untuk alur Fonnte yang sudah ada selama prototipe masih dipakai. Tambah tes kontrak webhook Meta, verifikasi permintaan, duplikasi event, urutan pesan, fallback AI/media, dan larangan akses lintas tenant sebelum pilot diperluas.

## Yang sengaja ditunda

Audio, integrasi CRM/pesanan, katalog, pembayaran otomatis, dan banyak pilihan model bisa menarik, tetapi jangan mengerjakannya sebelum alur teks, foto, handoff manusia, biaya, serta privasi pilot stabil. Khusus tindakan sensitif seperti membuat pesanan atau mengubah data pelanggan, wajib ada izin dan konfirmasi yang sesuai.

**Langkah berikut yang paling konkret:** tentukan bisnis pilot dan tugas bot pertama, lalu tulis daftar FAQ, aturan kapan menyerahkan ke manusia, serta estimasi biaya berdasarkan dokumentasi resmi terbaru. Setelah itu baru pecah pekerjaan MVP Meta menjadi tugas implementasi.
