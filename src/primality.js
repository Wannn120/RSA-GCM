'use strict';

const { modPow, toBigInt } = require('./math');

function isPrimeTrial(n) {
  n = toBigInt(n);
  if (n < 2n) return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n) return false;

  for (let i = 3n; i * i <= n; i += 2n) {
    if (n % i === 0n) return false;
  }
  return true;
}

function trialDivisionTrace(n) {
  n = toBigInt(n);
  const tested = [];
  if (n < 2n) return { prime: false, reason: 'Bilangan kurang dari 2 bukan prima.', tested };
  if (n === 2n) return { prime: true, reason: '2 adalah bilangan prima terkecil.', tested };
  if (n % 2n === 0n) return { prime: false, reason: 'Habis dibagi 2.', tested: [2n] };

  for (let i = 3n; i * i <= n; i += 2n) {
    const remainder = n % i;
    tested.push({ divisor: i, remainder });
    if (remainder === 0n) {
      return { prime: false, reason: `Habis dibagi ${i}.`, tested };
    }
  }
  return { prime: true, reason: 'Tidak ditemukan pembagi sampai akar kuadrat n.', tested };
}

function millerRabin(n, bases = [2n, 3n, 5n, 7n, 11n]) {
  n = toBigInt(n);
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }

  let d = n - 1n;
  let s = 0n;
  while (d % 2n === 0n) {
    d /= 2n;
    s++;
  }

  for (const rawBase of bases) {
    const a = rawBase % n;
    if (a === 0n) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;

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
