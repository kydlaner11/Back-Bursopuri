const prisma = require('../database/connection');

const createIdOrder = async (prefix) => {
  let modelName = '';

  // Menentukan model berdasarkan prefix
  switch (prefix) {
    case 'ORD':
      modelName = 'Order';
      break;
    case 'CUS':
      modelName = 'Customer';
      break;
    case 'ORDITEM':
      modelName = 'OrderItem';
      break;
    case 'OPT':
      modelName = 'MenuOption';
      break;
    case 'CHOICE':
      modelName = 'OptionChoice';
      break;
    default:
      throw new Error(`Prefix '${prefix}' tidak dikenali.`);
  }

  let uniqueId;
  while (true) {
    const last = await prisma[modelName].findFirst({
      where: {
        id: {
          startsWith: prefix,
        },
      },
      orderBy: {
        id: 'desc',
      },
      select: { id: true },
    });

    let nextNumber = 1;
    if (last && last.id) {
      const numericPart = parseInt(last.id.replace(prefix, ''));
      if (!isNaN(numericPart)) {
        nextNumber = numericPart + 1;
      }
    }

    uniqueId = `${prefix}${String(nextNumber).padStart(3, '0')}`;

    // Check if the generated ID is unique
    const existing = await prisma[modelName].findUnique({
      where: { id: uniqueId },
    });
    if (!existing) break; // Exit loop if ID is unique
  }

  return uniqueId;
};

module.exports = createIdOrder;
