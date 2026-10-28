# Panduan Presentasi MATDIS RSA Lab

## Tujuan proyek

Proyek ini memperlihatkan hubungan konsep Matematika Diskrit dengan RSA. Fokusnya bukan keamanan produksi, melainkan agar setiap rumus dan langkah hitung dapat dilihat dan dijelaskan.

## Alur RSA yang dapat dijelaskan

1. Pilih dua bilangan prima berbeda, p dan q.
2. Hitung modulus `n = p × q`.
3. Hitung fungsi totien Euler `φ(n) = (p - 1)(q - 1)`.
4. Pilih `e` dengan syarat `1 < e < φ(n)` dan `gcd(e, φ(n)) = 1`.
5. Cari `d` sebagai invers modulo, yaitu `e × d ≡ 1 (mod φ(n))`.
6. Public key adalah `(e, n)` dan private key adalah `(d, n)`.
7. Pesan diubah menjadi blok bilangan.
8. Enkripsi setiap blok dengan `c = m^e mod n`.
9. Dekripsi dengan `m = c^d mod n`.

## Contoh angka default

Gunakan `p = 61`, `q = 53`, dan `e = 17`.

Perhitungannya:

`n = 61 × 53 = 3233`

`φ(n) = 60 × 52 = 3120`

`gcd(17, 3120) = 1`, sehingga 17 boleh dipakai sebagai e.

Extended Euclid memberikan invers 17 modulo 3120 sebesar 2753, sehingga `d = 2753`.

Pemeriksaan:

`17 × 2753 mod 3120 = 1`

## Cara menjelaskan Euclid

Untuk mencari gcd, program berulang kali memakai pembagian bersisa.

Contoh bentuk umumnya:

`a = q × b + r`

Lalu pasangan berikutnya menjadi `a = b` dan `b = r`. Proses berhenti saat sisa 0. Nilai terakhir sebelum 0 adalah gcd.

## Cara menjelaskan Extended Euclid

Extended Euclid tidak hanya mencari gcd, tetapi juga koefisien x dan y yang memenuhi identitas Bezout:

`a × x + b × y = gcd(a, b)`

Karena pada RSA `gcd(e, φ) = 1`, maka:

`e × x + φ × y = 1`

Jika kedua sisi dilihat modulo φ, bagian `φ × y` menjadi 0. Akibatnya:

`e × x ≡ 1 (mod φ)`

Jadi x adalah invers e modulo φ. Jika x negatif, program menormalkannya dengan modulo positif.

## Cara menjelaskan square-and-multiply

Menghitung `m^e` langsung dapat menghasilkan bilangan sangat besar. Program menggunakan representasi biner eksponen.

Setiap iterasi melakukan tiga ide:

1. Periksa apakah bit eksponen saat ini ganjil.
2. Jika ganjil, kalikan result dengan base lalu ambil modulo.
3. Kuadratkan base modulo n dan bagi eksponen dengan 2.

Karena eksponen terus dibagi 2, jumlah iterasi sekitar logaritmik terhadap eksponen.

## Cara pesan diubah menjadi angka

Teks diubah menjadi byte UTF-8. Setiap byte bernilai 0 sampai 255. Untuk demo ini satu byte dijadikan satu blok RSA supaya tabel mudah dibaca.

Karena blok m harus memenuhi `0 <= m < n`, mode teks mensyaratkan `n > 255`.

## Kenapa memakai BigInt

JavaScript `Number` tidak dapat merepresentasikan semua bilangan bulat besar secara tepat. `BigInt` menyimpan bilangan bulat dengan presisi utuh, sehingga cocok untuk operasi RSA berbasis bilangan bulat.

BigInt adalah fitur bawaan JavaScript, bukan library eksternal.

## Library yang dipakai

Tidak ada dependency eksternal dalam `package.json`.

Node.js memakai beberapa modul bawaan:

- `crypto` untuk kunci acak dan AES-GCM pada CLI.
- `readline` untuk menerima input CLI interaktif.
- `assert` untuk self-check sederhana.
- `node:test` untuk menjalankan unit test.
- `perf_hooks` untuk mengukur waktu benchmark.
- `Buffer` adalah objek bawaan Node.js untuk konversi UTF-8 di sisi CLI.

GUI tidak memakai framework, CDN, atau library eksternal. GUI memakai HTML, CSS, JavaScript, `TextEncoder`, `TextDecoder`, `BigInt`, dan Web Crypto API bawaan browser. Demo hybrid memerlukan browser yang menyediakan `crypto.subtle`, biasanya pada HTTPS atau localhost.

## Batasan yang perlu disampaikan

RSA dalam proyek ini adalah implementasi pendidikan. Bilangan prima contoh sengaja kecil dan pesan diproses per byte agar prosesnya mudah diamati. Sistem nyata menggunakan bilangan jauh lebih besar, padding yang aman seperti OAEP atau PSS, dan implementasi kriptografi yang telah diaudit.

Proyek menyediakan tiga mode yang terpisah agar perannya mudah dibandingkan:

1. RSA mandiri mengenkripsi setiap byte pesan memakai public key dan mendekripsinya memakai private key. Ini membantu mempelajari RSA, tetapi tidak cocok untuk pesan besar atau produksi.
2. AES-GCM mandiri memakai satu kunci rahasia bersama untuk mengenkripsi dan mendekripsi. GCM juga menghasilkan authentication tag untuk mendeteksi perubahan data.
3. Hybrid memakai AES-GCM untuk isi pesan dan RSA buatan proyek untuk membungkus kunci AES. Mode hybrid menunjukkan bagaimana dua jenis algoritma dapat digabungkan.

Karena RSA contoh memakai modulus kecil, setiap byte dari kunci AES 32-byte dienkripsi sebagai blok RSA terpisah. Ini hanya demonstrasi alur; RSA textbook tanpa padding tidak aman.

## Menjelaskan simulasi hybrid RSA dan AES-GCM

1. Pengirim membuat kunci sesi AES-256 acak sepanjang 32 byte dan IV GCM acak sepanjang 12 byte.
2. Kunci AES diubah menjadi 32 blok byte. Setiap byte `kᵢ` dibungkus dengan RSA buatan proyek, `cᵢ = kᵢ^e mod n`. Cara per byte ini diperlukan hanya karena modulus contoh `n = 3233` tidak cukup besar untuk menampung satu kunci AES sebagai bilangan.
3. Pesan dienkripsi dengan AES-GCM menggunakan kunci sesi dan IV. Hasilnya mencakup ciphertext dan authentication tag 16 byte.
4. Penerima membuka setiap blok kunci dengan `kᵢ = cᵢ^d mod n`, kemudian memakai kunci tersebut, IV, ciphertext, dan tag untuk dekripsi AES-GCM.
5. Jika ciphertext atau tag berubah, pemeriksaan autentikasi gagal dan proses dekripsi menolak pesan.

CLI menggunakan modul bawaan Node.js `crypto` (`createCipheriv` dan `createDecipheriv`). GUI menggunakan Web Crypto API bawaan browser untuk AES-GCM. RSA tetap memakai implementasi `modPow` proyek.

## Membandingkan RSA, AES-GCM, dan hybrid

Perintah `node src/cli.js compare 61 53 17 "Halo Matdis"` dan halaman Perbandingan di GUI memproses pesan yang sama dengan tiga mode. Output menunjukkan apakah round-trip mengembalikan teks yang sama, waktu enkripsi/dekripsi satu kali, dan ukuran serialisasi payload JSON contoh.

Perbandingan konsep yang dapat disampaikan:

- RSA mandiri memakai pasangan public/private key dan pada proyek ini mengubah setiap byte menjadi satu blok cipher. Payload angka RSA menjadi panjang dan operasi modular dilakukan untuk setiap byte.
- AES-GCM mandiri cepat untuk isi pesan dan menyediakan authentication tag, tetapi penerima harus sudah memiliki kunci simetris yang sama.
- Hybrid menggunakan AES-GCM untuk data dan membungkus kunci sesi dengan RSA. Dalam proyek ini setiap byte kunci dibungkus RSA hanya karena modulus pendidikan terlalu kecil untuk menampung kunci utuh.

Waktu yang dicetak bukan kesimpulan performa umum. Pesan pendek, satu kali pengukuran, overhead browser/runtime, dan ukuran RSA kecil membuat angka sangat bergantung pada perangkat serta implementasi. Ukuran payload juga menghitung serialisasi JSON demonstrasi, bukan ukuran protokol jaringan nyata.

Demonstrasi ini **tidak aman untuk pemakaian nyata**: RSA menggunakan bilangan prima kecil, enkripsi RSA textbook tanpa padding, dan pembungkusan per byte. Sistem produksi harus menggunakan library kriptografi yang diaudit, RSA-OAEP atau mekanisme pertukaran kunci modern, serta ukuran kunci yang sesuai.

## Menjelaskan checksum dan perubahan data

Checksum yang digunakan dalam tugas adalah

`C = (Σ (i + 1) × byte[i]) mod 1000003`

`i` dimulai dari nol. Contoh teks `MATDIS` memiliki byte `77, 65, 84, 68, 73, 83`.

- Byte pertama menyumbang `1 × 77 = 77`.
- Byte kedua menyumbang `2 × 65 = 130`.
- Byte ketiga menyumbang `3 × 84 = 252`.
- Byte keempat menyumbang `4 × 68 = 272`.
- Byte kelima menyumbang `5 × 73 = 365`.
- Byte keenam menyumbang `6 × 83 = 498`.

Jumlah seluruh kontribusi adalah `1594`, sehingga checksum adalah `1594 mod 1000003 = 1594`. Jika byte pertama diganti dari 77 menjadi 78, total berubah menjadi 1595. Perbedaan ini terdeteksi, tetapi cara ini mungkin memiliki kolisi dan **bukan** hash kriptografis.

## Menjelaskan pengiriman Alice dan Bob

1. Bob membuat pasangan kunci `(e, n)` dan `(d, n)`.
2. Bob boleh membagikan `(e, n)` kepada Alice. Nilai `d` disimpan secara pribadi.
3. Alice mengubah teks menjadi byte dan menghitung `c = m^e mod n` untuk tiap byte.
4. Simulasi menyerahkan deret `c` ke Bob melalui pemanggilan fungsi, bukan jaringan sungguhan.
5. Bob memproses setiap `c` dengan `m = c^d mod n`, lalu byte dikembalikan menjadi teks UTF-8.

Semua proses berjalan lokal. Dua objek simulasi bernama Alice dan Bob hanya alat visualisasi alur data.

## Menjelaskan perbedaan CLI dan GUI

CLI memakai `src/cli.js` dan modul inti Node.js. GUI memakai `gui/index.html`, `styles.css`, dan `app.js` tanpa server. Keduanya menghasilkan perhitungan dengan rumus sama tetapi implementasi antarmukanya terpisah. Ini dipilih supaya GUI tetap dapat dibuka dengan klik dua kali pada file HTML, sekalipun tidak menjalankan CLI.

Jika dosen bertanya kenapa ada kode matematika pada sisi browser, jelaskan bahwa Node.js memakai modul CommonJS (`require`) sedangkan halaman HTML statis tidak langsung memuat CommonJS. Memindahkan seluruh modul ke format lintas lingkungan merupakan pengembangan selanjutnya, namun tidak dibutuhkan agar demonstrasi offline bekerja.
