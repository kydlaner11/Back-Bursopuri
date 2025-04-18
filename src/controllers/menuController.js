const prisma = require('../../database/connection');
const createId = require('../../utils/createId');
const { createError, BAD_REQUEST, NOT_FOUND } = require('../helpers/errorHelpers');
const supabaseClient = require('../middleware/supabase');

const getMenus = async (req, res, next) => {
  try {
    const menus = await prisma.menu.findMany();
    res.json({
      ok: true,
      message: 'Menus retrieved successfully',
      menus,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

const getMenuById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const menu = await prisma.menu.findUnique({
      where: { id: Number(id) },
      include: {
        menuProducts: true,
      },
    });   
    if (!menu) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Menu not found',
      }));
    }
    res.json({
      ok: true,
      message: 'Menu retrieved successfully',
      menu,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

const createMenu = async (req, res, next) => {
  // if (!req.body.menu) {
//   return next(createError({
//     status: BAD_REQUEST,
//     message: 'Menu data is required',
//   }));
// }

  try {
    const { nama, deskripsi, harga, kategori } = req.body;
    const file = req.file; // Access the first file in the array
    const fileName = `${createId(6)}.jpg`;

    const { data, error } = await supabaseClient.storage
      .from('menu')
      .upload(`public/${fileName}`, file.buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.mimetype,
      });

      let imageUrlfilename;
    if (data) {
      const {data: imageUrl} = await supabaseClient.storage
        .from('menu')
        .getPublicUrl(data.path);
      imageUrlfilename = imageUrl.publicUrl;
    }

    if (error) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'File upload failed',
      }));
    }

    console.log("data", data);
    const lastMenu = await prisma.menu.findFirst({
      orderBy: {
        id_menu: 'desc',
      },
    });

    let newId = 'BUR001'; // Initialize newId with a default value
    if (lastMenu) {
      const lastNumber = parseInt(lastMenu.id_menu.replace('BUR', '')) || 0; // Ensure lastNumber is defined
      newId = 'BUR' + String(lastNumber + 1).padStart(3, '0'); // Format BURxxx
    }

    const menu = await prisma.menu.create({
      data: {
        id_menu: newId,
        nama,
        deskripsi,
        harga: parseInt(harga), // Ensure harga is an integer
        kategori,
        image: data.path,
        image_url: imageUrlfilename, // Use the correct field name
      },
    });

    res.json({
      ok: true,
      message: 'Menu created successfully',
      menu,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

const updateMenu = async (req, res, next) => {
  // if (!req.body.menu) {
  //   return next(createError({
  //     status: BAD_REQUEST,
  //     message: 'Menu data is required',
  //   }));
  // }

  try {
    const { id } = req.params;
    const  {nama, deskripsi, harga, kategori } = req.body;
    const getMenu = await prisma.menu.findFirst({
      where: {
        id_menu: id,
      },
    });
    if (!getMenuById) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Menu not found',
      }));
    }

    const file = req.file; 
    if (file) {
      const fileName = `${createId(6)}.jpg`;

      if (getMenu.image) {
        const { data, error } = await supabaseClient.storage
          .from('menu')
          .remove([getMenu.image]);
      }

      const { data, error } = await supabaseClient.storage
        .from('menu')
        .upload(`public/${fileName}`, file.buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.mimetype,
        });

        let imageUrlfilename;
      if (data) {
        const {data: imageUrl} = await supabaseClient.storage
          .from('menu')
          .getPublicUrl(data.path);
        imageUrlfilename = imageUrl.publicUrl;
      }
      const menu = await prisma.menu.update({
        where: { id_menu: id },
        data: {
          nama: nama? nama : getMenu.nama,
          deskripsi : deskripsi? deskripsi : getMenu.deskripsi,
          harga: harga? parseInt(harga) : getMenu.harga,
          kategori: kategori? kategori : getMenu.kategori,
          image: data? data.path : "",
          image_url: imageUrlfilename? imageUrlfilename : ""
        },
      });
      if (!menu) {
        return next(createError({
          status: NOT_FOUND,
          message: 'Menu not found',
        }));
      }
      res.json({
        ok: true,
        message: 'Menu updated successfully',
        menu,
      });
    } else {
      const menu = await prisma.menu.update({
        where: { id_menu: id },
        data: {
          nama: nama? nama : getMenu.nama,
          deskripsi : deskripsi? deskripsi : getMenu.deskripsi,
          harga: harga? parseInt(harga) : getMenu.harga,
          kategori: kategori? kategori : getMenu.kategori,
        },
      });
      if (!menu) {
        return next(createError({
          status: NOT_FOUND,
          message: 'Menu not found',
        }));
      }
      res.json({
        ok: true,
        message: 'Menu updated successfully',
        menu,
      });
    }
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

const deleteMenu = async (req, res, next) => {
  const { id } = req.params;
  try {
    const menu = await prisma.menu.findUnique({
      where: { id_menu: id },
    });

    if (!menu) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Menu not found',
      }));
    }

    await prisma.menu.delete({
      where: { id_menu: id },
    });

    res.json({
      ok: true,
      message: 'Menu deleted successfully',
      menu,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

module.exports = {
  getMenus,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,
};