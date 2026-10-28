'use strict';

const crypto = require('crypto');
const { generateKeyPairFromPrimes, encryptBlocks, decryptBlocks, decryptBlocksCrt } = require('./rsa');
const { encodeText, decodeText } = require('./message-codec');
const { hybridEncrypt, hybridDecryptCrt } = require('./hybrid');

const LIMITS = {
  maxRuns: 1000,
  minPrime: 17,
  maxPrime: 1000000,
  maxMessageBytes: 4096
};

// Validasi sebelum mengalokasikan memori atau memulai pekerjaan batch yang mahal.
function assertIntegerRange(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} harus bilangan bulat antara ${min} dan ${max}.`);
  }
}

// Sieve Eratosthenes menandai bilangan komposit agar prima dalam rentang bisa dipilih acak.
function listPrimes(minimum, maximum) {
  // Indeks array mewakili kandidat angka; 1 berarti masih dianggap prima.
  const sieve = new Uint8Array(maximum + 1);
  sieve.fill(1, 2);
  // Jika factor belum dicoret, tandai kelipatan mulai dari kuadratnya sebagai komposit.
  for (let factor = 2; factor * factor <= maximum; factor++) {
    if (!sieve[factor]) continue;
    for (let multiple = factor * factor; multiple <= maximum; multiple += factor) {
      sieve[multiple] = 0;
    }
  }
  // Kembalikan hanya prima dalam rentang yang diminta, bukan seluruh sieve.
  const primes = [];
  for (let candidate = minimum; candidate <= maximum; candidate++) {
    if (sieve[candidate]) primes.push(BigInt(candidate));
  }
  return primes;
}

// Isi pesan dibuat printable agar mudah diperiksa, tetapi panjang byte tetap terkontrol.
function randomMessage(byteLength) {
  const bytes = crypto.randomBytes(byteLength);
  return Array.from(bytes, byte => String.fromCharCode(32 + (byte % 95))).join('');
}

// Jam monotonic beresolusi nanodetik menghindari perubahan jam sistem saat pengukuran.
function elapsedMilliseconds(action) {
  const startedAt = process.hrtime.bigint();
  const result = action();
  return { result, elapsedMs: Number(process.hrtime.bigint() - startedAt) / 1e6 };
}

// Ukur ukuran seperti payload transfer: JSON UTF-8 dengan BigInt direpresentasikan string.
function payloadByteLength(value) {
  return Buffer.byteLength(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item));
}

// Ringkas sampel terurut dengan rata-rata, median, nilai minimum, dan maksimum.
function summarize(rows, field) {
  const values = rows.map(row => row[field]).sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  const middle = Math.floor(values.length / 2);
  return {
    mean: sum / values.length,
    median: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2,
    min: values[0],
    max: values[values.length - 1]
  };
}

// Batch membandingkan RSA mandiri dengan AES-GCM yang kuncinya dibungkus RSA-CRT.
function runComparisonBatch({ runs = 100, minPrime = 100, maxPrime = 999, messageBytes = 128 } = {}) {
  // Batas ini menjaga generator demo tetap responsif dan ukuran output tidak tak terbatas.
  assertIntegerRange(runs, 'Jumlah percobaan', 1, LIMITS.maxRuns);
  assertIntegerRange(minPrime, 'Prima minimum', LIMITS.minPrime, LIMITS.maxPrime);
  assertIntegerRange(maxPrime, 'Prima maksimum', LIMITS.minPrime, LIMITS.maxPrime);
  assertIntegerRange(messageBytes, 'Ukuran pesan', 1, LIMITS.maxMessageBytes);
  if (minPrime >= maxPrime) throw new RangeError('Prima minimum harus lebih kecil dari prima maksimum.');
  // Daftar prima dihitung sekali, lalu digunakan ulang untuk semua percobaan.
  const primes = listPrimes(minPrime, maxPrime);
  if (primes.length < 2) throw new RangeError('Rentang prima harus memuat setidaknya dua bilangan prima berbeda.');
  // p*q sama dengan q*p, jadi jumlah n berbeda adalah kombinasi pasangan prima.
  const distinctModuli = (primes.length * (primes.length - 1)) / 2;
  if (runs > distinctModuli) {
    throw new RangeError(`Rentang ini hanya menyediakan ${distinctModuli} pasangan n unik. Kurangi percobaan atau perlebar rentang.`);
  }

  const rows = [];
  const usedModuli = new Set();
  for (let index = 0; index < runs; index++) {
    let p;
    let q;
    let modulus;
    let foundUniqueModulus = false;
    // Pilih dua prima berbeda dan ulangi bila modulus yang sama pernah dipakai.
    for (let attempt = 0; attempt < 10000; attempt++) {
      p = primes[crypto.randomInt(0, primes.length)];
      q = primes[crypto.randomInt(0, primes.length)];
      if (p === q) continue;
      modulus = p * q;
      if (usedModuli.has(modulus.toString())) continue;
      foundUniqueModulus = true;
      break;
    }
    if (!foundUniqueModulus) {
      throw new RangeError('Rentang prima terlalu sempit untuk menghasilkan n unik sebanyak itu. Kurangi percobaan atau perlebar rentang.');
    }
    usedModuli.add(modulus.toString());
    // Pasangan kunci yang sama dipakai kedua metode agar hasil perbandingan adil.
    const generated = elapsedMilliseconds(() => generateKeyPairFromPrimes(p, q));
    const pair = generated.result;
    // Kedua skema menerima pesan acak yang persis sama pada putaran ini.
    const message = randomMessage(messageBytes);
    const messageBlocks = encodeText(message);
    // RSA mandiri mengenkripsi tiap byte sebagai satu blok modular terpisah.
    const rsaEncrypted = elapsedMilliseconds(() => encryptBlocks(messageBlocks, pair.publicKey));
    const rsaDecrypted = elapsedMilliseconds(() => decryptBlocks(rsaEncrypted.result, pair.privateKey));
    // Hybrid mengenkripsi isi dengan AES lalu membungkus kuncinya; CRT dipakai saat dibuka.
    const hybridEncrypted = elapsedMilliseconds(() => hybridEncrypt(message, pair.publicKey));
    const hybridDecrypted = elapsedMilliseconds(() => hybridDecryptCrt(
      hybridEncrypted.result,
      pair.privateKey,
      pair.details.p,
      pair.details.q
    ));
    // Simpan teks pulih dan pengukuran keduanya untuk menilai kebenaran round-trip.
    const rsaRestored = decodeText(rsaDecrypted.result);
    const hybridRestored = hybridDecrypted.result.text;

    // Satu baris menyimpan input, waktu, ukuran payload, dan indikator keberhasilan sampel.
    rows.push({
      run: index + 1,
      p: p.toString(),
      q: q.toString(),
      n: pair.publicKey.n.toString(),
      messageBytes: Buffer.byteLength(message),
      keyGenerationMs: generated.elapsedMs,
      rsaEncryptMs: rsaEncrypted.elapsedMs,
      rsaDecryptMs: rsaDecrypted.elapsedMs,
      rsaPayloadBytes: payloadByteLength(rsaEncrypted.result),
      hybridEncryptMs: hybridEncrypted.elapsedMs,
      hybridDecryptCrtMs: hybridDecrypted.elapsedMs,
      hybridPayloadBytes: payloadByteLength(hybridEncrypted.result),
      rsaRoundTrip: rsaRestored === message,
      hybridRoundTrip: hybridRestored === message
    });
  }

  // Ringkasan memperlihatkan kecenderungan; rows tetap memuat data mentah untuk analisis.
  return {
    settings: { runs, minPrime, maxPrime, messageBytes },
    summary: {
      rsaEncryptMs: summarize(rows, 'rsaEncryptMs'),
      rsaDecryptMs: summarize(rows, 'rsaDecryptMs'),
      rsaPayloadBytes: summarize(rows, 'rsaPayloadBytes'),
      hybridEncryptMs: summarize(rows, 'hybridEncryptMs'),
      hybridDecryptCrtMs: summarize(rows, 'hybridDecryptCrtMs'),
      hybridPayloadBytes: summarize(rows, 'hybridPayloadBytes')
    },
    allRoundTripsPassed: rows.every(row => row.rsaRoundTrip && row.hybridRoundTrip),
    rows
  };
}

module.exports = { LIMITS, runComparisonBatch };
