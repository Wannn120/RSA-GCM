# RSA-GCM

Proyek Matematika Diskrit untuk mempelajari RSA melalui dua antarmuka yang terpisah: CLI dan GUI statis. CLI tetap dapat digunakan sendiri, sedangkan GUI dapat dibuka langsung dari browser tanpa mengubah fungsi CLI.

## Fitur

- Pembentukan kunci RSA dari p dan q.
- Validasi bilangan prima.
- Euclidean Algorithm dengan jejak langkah.
- Extended Euclidean Algorithm untuk mencari invers modulo.
- Modular exponentiation memakai square-and-multiply.
- Encoding dan decoding UTF-8.
- Enkripsi dan dekripsi pesan per byte.
- Trace data lengkap untuk bahan presentasi.
- Simulasi pengiriman antar pihak.
- Simulasi perubahan blok dan checksum sederhana.
- Hybrid RSA + AES-256-GCM: RSA buatan proyek membungkus kunci sesi, AES-GCM mengenkripsi dan mengautentikasi pesan.
- Demo AES-256-GCM mandiri untuk mempelajari enkripsi simetris tanpa RSA.
- Perbandingan RSA, AES-GCM, dan hybrid pada pesan yang sama, termasuk waktu satu putaran dan ukuran payload contoh.
- CLI interaktif dan CLI berbasis perintah.
- GUI statis bergaya aplikasi percakapan dua panel.
- Unit test dan self-check tanpa dependency eksternal.

## Kebutuhan

Node.js versi 18 atau lebih baru untuk CLI dan test.

GUI membutuhkan browser modern dengan Web Crypto API untuk demo AES-GCM. Browser harus mengizinkan `crypto.subtle` (misalnya pada HTTPS atau localhost). CLI dan test membutuhkan Node.js.

## Menjalankan CLI

Masuk ke folder proyek lalu jalankan:

```bash
npm start
```

Atau langsung menjalankan demo:

```bash
node src/cli.js demo
```

Contoh perintah lain:

```bash
node src/cli.js prime 61
node src/cli.js gcd 3120 17
node src/cli.js egcd 17 3120
node src/cli.js modpow 65 17 3233
node src/cli.js key 61 53 17
node src/cli.js encrypt 61 53 17 "Halo Matdis"
node src/cli.js aes "Halo Matdis"
node src/cli.js hybrid 61 53 17 "Halo Matdis"
node src/cli.js compare 61 53 17 "Halo Matdis"
```

## Menjalankan GUI

Buka file berikut dengan browser:

```text
gui/index.html
```

GUI hanya HTML, CSS, dan JavaScript statis, tanpa proses instalasi. Jika browser tidak menyediakan Web Crypto API saat file dibuka langsung, jalankan GUI dari konteks aman seperti localhost atau HTTPS.

## Menjalankan test

```bash
npm test
```

Pemeriksaan cepat:

```bash
npm run selfcheck
```

Benchmark:

```bash
npm run benchmark
```

## Contoh RSA default

Nilai yang dipakai pada demo:

- `p = 61`
- `q = 53`
- `n = 3233`
- `φ(n) = 3120`
- `e = 17`
- `d = 2753`

Public key adalah `(17, 3233)` dan private key adalah `(2753, 3233)`.

## Dependency dan library

Proyek tidak memiliki dependency eksternal. Semua algoritma matematika utama ditulis langsung agar mudah diterangkan saat presentasi.

Modul bawaan Node.js yang digunakan meliputi `crypto` untuk AES-GCM dan kunci acak, serta modul pendukung untuk input terminal, testing, assertion, pengukuran waktu, dan encoding byte. Penjelasan rinci ada di `docs/PRESENTASI.md`.

## Catatan keamanan

Proyek ini dibuat untuk pembelajaran Matematika Diskrit, bukan untuk melindungi data sungguhan. Implementasi produksi perlu library kriptografi yang telah diaudit, ukuran kunci besar, random number generator yang sesuai, serta padding standar.

## Struktur singkat

```text
matdis-rsa-lab/
  docs/
    PRESENTASI.md
    STRUKTUR.md
  gui/
    index.html
    styles.css
    app.js
  src/
    benchmark.js
    aes-gcm.js
    cli.js
    format.js
    hybrid.js
    index.js
    math.js
    message-codec.js
    primality.js
    rsa.js
    rsa-trace.js
    selfcheck.js
    server-simulator.js
    tamper.js
  tests/
    math.test.js
    rsa.test.js
  package.json
  README.md
```

## Modul tambahan yang tersedia di CLI dan GUI

- Hybrid RSA + AES-GCM: kunci sesi AES-256 acak dibungkus RSA buatan proyek; AES-GCM mengenkripsi pesan dan authentication tag memverifikasi integritasnya.
- AES-GCM mandiri: mengenkripsi pesan dengan kunci simetris acak tanpa RSA.
- Perbandingan: menjalankan RSA per byte, AES-GCM mandiri, dan hybrid pada masukan yang sama. Angka waktu hanya satu putaran demonstrasi, bukan benchmark statistik.
- Perubahan data: checksum berbobot dan dampak mengubah satu byte. Checksum ini tidak menjamin integritas secara kriptografis.
- Pengiriman pesan: simulasi lokal Alice ke Bob dengan public key dan private key. Tidak menggunakan jaringan sungguhan.

CLI contoh:

```bash
node src/cli.js hybrid 61 53 17 "Halo Matdis"
node src/cli.js tamper MATDIS 0 1
node src/cli.js send 61 53 17 "Halo Bob"
```

GUI menyediakan modul RSA, AES-GCM mandiri, perbandingan, dan hybrid lewat menu di sidebar. Struktur disusun sesuai fungsinya dan bukan salinan screenshot referensi.

Hybrid ini khusus demonstrasi pendidikan: kunci AES 256-bit dibungkus RSA per byte agar dapat digunakan dengan modulus kecil contoh proyek. RSA textbook tanpa padding dan modulus kecil tidak aman untuk data nyata. Untuk aplikasi produksi, gunakan implementasi kriptografi teruji dengan RSA-OAEP (atau mekanisme pertukaran kunci modern) dan AES-GCM.
