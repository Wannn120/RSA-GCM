# Struktur Proyek

## Folder src

`math.js` berisi gcd, Extended Euclid, modulo positif, invers modulo, dan modular exponentiation.

`primality.js` berisi uji prima trial division dan Miller-Rabin sederhana untuk pembelajaran.

`rsa.js` berisi pembentukan pasangan kunci, enkripsi, dekripsi, serta tanda tangan angka sederhana.

Modul `rsa.js` juga menyediakan dekripsi RSA-CRT yang menghitung residu modulo p dan q lalu menggabungkannya. Enkripsi RSA tetap sama.

`rsa-trace.js` menghasilkan data jejak untuk menjelaskan langkah pembentukan kunci dan modular exponentiation.

`message-codec.js` mengubah teks UTF-8 menjadi blok byte dan sebaliknya.

`aes-gcm.js` menjalankan AES-256-GCM mandiri, membuat kunci sesi acak, dan menolak data dengan authentication tag yang tidak valid.

`hybrid.js` mendemonstrasikan hybrid RSA + AES-256-GCM. Kunci sesi AES acak dibungkus RSA per byte agar dapat digunakan dengan modulus kecil contoh proyek; modul ini hanya pendidikan.

`comparison.js` menjalankan batch perbandingan RSA biasa dengan hybrid RSA + AES-GCM/CRT. Generator menghasilkan p, q, modulus n unik, dan pesan acak, lalu menyimpan statistik serta data tiap sampel.

`tamper.js` berisi checksum sederhana dan fungsi mengubah satu blok untuk melihat efek perubahan data.

`server-simulator.js` mensimulasikan dua pihak yang bertukar public key lalu mengirim cipher.

`format.js` membantu pencetakan JSON BigInt dan tabel CLI.

`cli.js` adalah antarmuka command line. File ini memakai modul inti tetapi tidak mengubah fungsi matematikanya.

`benchmark.js` mengukur performa modular exponentiation.

`selfcheck.js` menjalankan pemeriksaan cepat atas hasil penting.

`index.js` mengekspor modul utama agar mudah dipakai dari kode lain.

## Folder gui

`index.html` adalah struktur halaman.

`src-loader.js` memuat semua file di `src` ke browser dan mengekspose modul tersebut ke `window.RSA_GCM` agar GUI bisa memakai fungsi crypto tanpa build tool tambahan.

`app.js` adalah bootstrap kecil yang menunggu event `rsa-gcm-ready`, lalu menjalankan UI utama.

`pages.js` berisi semua halaman demo dan renderer UI. Ia memanggil fungsi dari `src` untuk membuat hasil perhitungan, lalu menampilkannya ke dalam template HTML halaman.

`styles.css` membuat tampilan dua panel yang terinspirasi pola antarmuka WhatsApp Web, dengan sidebar modul di kiri dan area percakapan/data di kanan.

## Folder tests

Tes memakai `node:test` bawaan Node.js. Tidak perlu Jest atau library lain.

## Alur kerja fitur dasar

### 1. Alur RSA klasik

- Pengguna memasukkan teks, misalnya `Halo Bob`.
- `message-codec.js` memanggil `encodeText()`, lalu mengubah string UTF-8 menjadi array byte.
- Setiap byte diubah menjadi `BigInt` agar sesuai operasi matematika RSA.
- `rsa.js` menerima blok tersebut dan memanggil `encryptBlocks()`.
- Setiap blok dicek dengan rumus `c = m^e mod n` menggunakan public key.
- Ciphertext dikirim atau ditampilkan ke user.
- Pada sisi penerima, `decryptBlocks()` menghitung `m = c^d mod n` untuk setiap blok.
- Hasil blok yang sudah kembali diubah menjadi byte lalu dikembalikan ke string dengan `decodeText()`.
- Akhirnya hasil plaintext sama dengan input awal jika semua langkah benar.

Contoh alurnya:

`teks -> encodeText -> [byte] -> encryptBlocks -> ciphertext -> decryptBlocks -> [byte] -> decodeText -> teks asli`

### 2. Alur RSA dengan dekripsi CRT

- Proses enkripsi tetap sama seperti RSA klasik.
- Saat penerima membuka ciphertext, `decryptBlocksCrt()` dipanggil dengan `p` dan `q`.
- Algoritma CRT menghitung:
  - `dp = d mod (p - 1)`
  - `dq = d mod (q - 1)`
  - `m1 = c^dp mod p`
  - `m2 = c^dq mod q`
  - `h = q^{-1}(m1 - m2) mod p`
  - `m = m2 + h*q`
- Hasilnya adalah plaintext yang sama dengan dekripsi biasa, hanya prosesnya lebih efisien secara matematis.

### 3. Alur hybrid RSA + AES-GCM

- Pengguna memasukkan teks biasa.
- `hybrid.js` membuat kunci AES baru secara acak sebagai kunci sesi.
- `encryptAesGcm()` mengenkripsi teks dengan AES-256-GCM dan menghasilkan:
  - `iv`
  - `ciphertext`
  - `authTag`
- Kunci AES kemudian dibungkus satu per byte dengan RSA public key penerima.
- Setiap byte dari kunci AES diproses dengan `encryptNumber()` dan hasilnya disimpan dalam `wrappedKey`.
- Hasil payload hybrid berisi:
  - `iv`
  - `ciphertext`
  - `authTag`
  - `wrappedKey`
- Saat penerima menerima payload:
  - `wrappedKey` dibuka satu per byte lewat `decryptNumber()` atau `decryptNumberCrt()`
  - Kunci AES dipulihkan kembali
  - `decryptAesGcm()` memverifikasi `authTag`
  - Jika valid, plaintext dikembalikan
  - Jika tag tidak valid, proses dekripsi gagal dan data dianggap telah berubah

Alur singkatnya:

`teks -> AES-GCM encrypt -> ciphertext + tag + iv -> kunci AES dibungkus RSA -> payload hybrid -> kunci RSA buka -> decrypt AES-GCM -> plaintext`

### 4. Alur GUI/browser

- `gui/index.html` memuat `src-loader.js` terlebih dahulu.
- `src-loader.js` memanggil `loadScript()` untuk setiap file dari `src`.
- Setelah semua modul selesai dimuat, browser mengirim event `rsa-gcm-ready`.
- `gui/app.js` menangkap event itu dan menjalankan `RSAUi.init()`.
- `pages.js` lalu merender halaman sesuai tombol yang diklik, misalnya `manualRsa`, `manualHybrid`, `compare`, `tamper`, dan `send`.
- Pada setiap halaman, fungsi render memanggil modul `src` untuk menghitung nilai, lalu menampilkan hasil dalam bentuk chat, tabel, atau ringkasan statistik.

### 5. Alur simulasi pengiriman pesan

- `server-simulator.js` membuat objek `ServerSimulator` untuk Alice dan Bob.
- Alice mengambil public key Bob.
- Alice memanggil `encodeText(text)` lalu `encryptBlocks()`.
- ciphertext dikirim ke Bob melalui `sendTo()`.
- Bob memanggil `receiveCipher()`, yang memanggil `decryptBlocks()` dengan private key Bob.
- Hasilnya dikembalikan sebagai objek yang berisi `from`, `cipherBlocks`, `plainBlocks`, dan `text`.
- Ini menggambarkan bagaimana kunci publik dan privat bekerja dalam komunikasi RSA dasar.

## Prinsip penataan

Folder dibagi berdasarkan tanggung jawab, bukan agar sesuai dengan tampilan referensi. CLI memanggil modul Node.js secara langsung. GUI menggunakan implementasi JavaScript browser yang mandiri sehingga tetap berjalan saat `index.html` dibuka tanpa server. Karena keduanya memiliki implementasi masing-masing, pengujian contoh penting perlu dilakukan pada keduanya agar tidak terjadi perbedaan hasil.

Halaman GUI tambahan mencakup AES-GCM mandiri, dekripsi RSA-CRT, eksperimen perbandingan RSA biasa dengan hybrid RSA + AES-GCM/CRT, Hybrid RSA + AES-GCM, Perubahan Data, dan Pengiriman Pesan. Halaman perbandingan menampilkan grafik batang, statistik, tabel data lengkap, serta ekspor CSV. GUI memakai Web Crypto API bawaan browser untuk AES-GCM dan memerlukan browser modern dalam konteks aman yang menyediakan `crypto.subtle`. Modul logika Node.js masing-masing tetap berada di `src/aes-gcm.js`, `src/comparison.js`, `src/hybrid.js`, `src/tamper.js`, dan `src/server-simulator.js`.
