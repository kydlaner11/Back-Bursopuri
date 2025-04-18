const prisma = require('../../database/connection');


const getAllMenus = async (props) => (
  await prisma.menu.findMany({
    where: {
      ...props,
    },
    include: {
      menuProducts: true,
    },
  })

)