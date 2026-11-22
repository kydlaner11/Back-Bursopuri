const { Prisma } = require('@prisma/client');
const { D, badRequest } = require('./financeUtils');

const ROUND = Prisma.Decimal.ROUND_HALF_UP;

/**
 * Inti hitungan penjualan "berbasis uang diterima".
 *
 *  - net  : uang diterima (FAKTA, dari aplikasi merchant, sudah dipotong komisi & promo)
 *  - gross: omzet kotor, opsional. Kalau diisi -> komisi sebenarnya = gross - net
 *  - rateOverride: komisi untuk ESTIMASI omzet kotor (mis. hari promo). Kalau kosong
 *    dipakai komisi default kanal.
 *
 * Estimasi omzet kotor: gross = net / (1 - komisi)   (BUKAN net x (1 + komisi))
 *
 * Kanal offline (isOnline=false): tidak ada komisi, kotor = bersih, selalu pasti.
 */
const computeSale = ({ net, gross, rateOverride, channel }) => {
  const netD = D(net);

  if (!channel.isOnline) {
    return {
      netReceived: netD,
      grossSales: netD,
      platformFee: D(0),
      commissionRate: D(0),
      isGrossEstimated: false,
    };
  }

  const hasGross = gross !== null && gross !== undefined;
  const hasRate = rateOverride !== null && rateOverride !== undefined;

  if (hasGross) {
    if (hasRate) throw badRequest('Isi omzet kotor ATAU komisi, tidak keduanya');
    const grossD = D(gross);
    if (grossD.lt(netD)) {
      throw badRequest('Omzet kotor tidak boleh lebih kecil dari uang diterima');
    }
    const fee = grossD.sub(netD);
    const rate = grossD.gt(0)
      ? fee.div(grossD).toDecimalPlaces(4, ROUND)
      : D(channel.commissionRate);
    return {
      netReceived: netD,
      grossSales: grossD,
      platformFee: fee,
      commissionRate: rate,
      isGrossEstimated: false,
    };
  }

  const rate = D(hasRate ? rateOverride : channel.commissionRate);
  if (rate.lt(0) || rate.gte(1)) throw badRequest('Komisi harus di bawah 100%');

  const grossD = netD.div(D(1).sub(rate)).toDecimalPlaces(2, ROUND);
  return {
    netReceived: netD,
    grossSales: grossD,
    platformFee: grossD.sub(netD),
    commissionRate: rate,
    isGrossEstimated: rate.gt(0) && netD.gt(0),
  };
};

module.exports = { computeSale };