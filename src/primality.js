'use strict';

const { modPow, toBigInt } = require('./math');

function isPrimeTrial(n) {
  // Trial division menentukan prima dengan mencoba semua pembagi ganjil sampai √n.
  n = toBigInt(n);
  if (n < 2n) return false; // Bilangan kurang dari 2 bukan prima.
  if (n === 2n || n === 3n) return true; // 2 dan 3 adalah bilangan prima.
  if (n % 2n === 0n) return false; // Bilangan genap selain 2 bukan prima.

  for (let i = 3n; i * i <= n; i += 2n) { // Cukup uji pembagi ganjil sampai akar kuadrat n.
    if (n % i === 0n) return false;
  }
  return true;
}

function trialDivisionTrace(n) {
  // Versi pembelajaran mengembalikan pembagi dan sisa yang sempat diuji.
  n = toBigInt(n);
  const tested = [];
  if (n < 2n) return { prime: false, reason: 'Bilangan kurang dari 2 bukan prima.', tested };
  if (n === 2n) return { prime: true, reason: '2 adalah bilangan prima terkecil.', tested };
  if (n % 2n === 0n) return { prime: false, reason: 'Habis dibagi 2.', tested: [2n] };

  for (let i = 3n; i * i <= n; i += 2n) { // Cukup uji pembagi ganjil sampai akar kuadrat n.
    const remainder = n % i;
    tested.push({ divisor: i, remainder });
    if (remainder === 0n) {
      return { prime: false, reason: `Habis dibagi ${i}.`, tested };
    }
  }
  return { prime: true, reason: 'Tidak ditemukan pembagi sampai akar kuadrat n.', tested };
}

function millerRabin(n, bases = [2n, 3n, 5n, 7n, 11n]) {
  // Miller-Rabin adalah tes probabilistik; daftar basis memengaruhi kekuatan deteksinya.
  n = toBigInt(n);
  // Tangani bilangan kecil dan faktor prima kecil sebelum pengujian modular.
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }

  // Tulis n-1 = d*2^s dengan d ganjil, sesuai bentuk uji saksi Miller-Rabin.
  let d = n - 1n;
  let s = 0n;
  while (d % 2n === 0n) {
    d /= 2n;
    s++;
  }

  for (const rawBase of bases) {
    // Tiap basis menguji apakah n berperilaku seperti prima terhadap basis tersebut.
    const a = rawBase % n;
    if (a === 0n) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;

    // Kuadratkan berturut-turut; menemukan n-1 berarti basis ini belum membuktikan komposit.
    let witnessFound = true;
    for (let r = 1n; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) {
        witnessFound = false;
        break;
      }
    }
    if (witnessFound) return false;
  }
  return true;
}

module.exports = { isPrimeTrial, trialDivisionTrace, millerRabin }; 
