# Struktur Proyek

## Folder src

`math.js` berisi gcd, Extended Euclid, modulo positif, invers modulo, dan modular exponentiation.

`primality.js` berisi uji prima trial division dan Miller-Rabin sederhana untuk pembelajaran.

`rsa.js` berisi pembentukan pasangan kunci, enkripsi, dekripsi, serta tanda tangan angka sederhana.

`rsa-trace.js` menghasilkan data jejak untuk menjelaskan langkah pembentukan kunci dan modular exponentiation.

`message-codec.js` mengubah teks UTF-8 menjadi blok byte dan sebaliknya.

`aes-gcm.js` menjalankan AES-256-GCM mandiri, membuat kunci sesi acak, dan menolak data dengan authentication tag yang tidak valid.

`hybrid.js` mendemonstrasikan hybrid RSA + AES-256-GCM. Kunci sesi AES acak dibungkus RSA per byte agar dapat digunakan dengan modulus kecil contoh proyek; modul ini hanya pendidikan.

`tamper.js` berisi checksum sederhana dan fungsi mengubah satu blok untuk melihat efek perubahan data.

`server-simulator.js` mensimulasikan dua pihak yang bertukar public key lalu mengirim cipher.

`format.js` membantu pencetakan JSON BigInt dan tabel CLI.

`cli.js` adalah antarmuka command line. File ini memakai modul inti tetapi tidak mengubah fungsi matematikanya.

`benchmark.js` mengukur performa modular exponentiation.

`selfcheck.js` menjalankan pemeriksaan cepat atas hasil penting.

`index.js` mengekspor modul utama agar mudah dipakai dari kode lain.

## Folder gui

`index.html` adalah struktur halaman.

`styles.css` membuat tampilan dua panel yang terinspirasi pola antarmuka WhatsApp Web, dengan sidebar modul di kiri dan area percakapan/data di kanan.

`app.js` berisi logika GUI dan implementasi matematika browser. GUI sengaja berdiri sendiri sehingga dapat dibuka tanpa Node.js dan tidak merusak CLI.

## Folder tests

Tes memakai `node:test` bawaan Node.js. Tidak perlu Jest atau library lain.

## Prinsip penataan

Folder dibagi berdasarkan tanggung jawab, bukan agar sesuai dengan tampilan referensi. CLI memanggil modul Node.js secara langsung. GUI menggunakan implementasi JavaScript browser yang mandiri sehingga tetap berjalan saat `index.html` dibuka tanpa server. Karena keduanya memiliki implementasi masing-masing, pengujian contoh penting perlu dilakukan pada keduanya agar tidak terjadi perbedaan hasil.

Halaman GUI tambahan mencakup AES-GCM mandiri, perbandingan RSA/AES/hybrid, Hybrid RSA + AES-GCM, Perubahan Data, dan Pengiriman Pesan. GUI memakai Web Crypto API bawaan browser untuk AES-GCM dan memerlukan browser modern dalam konteks aman yang menyediakan `crypto.subtle`. Modul logika Node.js masing-masing tetap berada di `src/aes-gcm.js`, `src/hybrid.js`, `src/tamper.js`, dan `src/server-simulator.js`.
