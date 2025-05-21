const prisma = require('../../database/connection');
const createId = require('../../utils/createId');
const { createError, BAD_REQUEST, NOT_FOUND } = require('../helpers/errorHelpers');
const supabaseClient = require('../middleware/supabase');

const getMenus = async (req, res, next) => {
  try {
    const menus = await prisma.menu.findMany({
      orderBy: {
        id_menu: 'asc', 
      },
      include: {
        category: { // Include the related Category
          select: {
            name: true, // Only select the 'name' field from the Category model
          },
        },
        options: { // Include options with their choices
          include: {
            choices: true,
          },
        },
      },
    });

    // Map the category name into the 'kategori' field and format options
    const menusWithKategori = menus.map(menu => {
      // Format options for this specific menu
      const formattedOptions = {};
      menu.options.forEach(option => {
        formattedOptions[option.title] = {
          max: option.max,
          optional: option.optional,
          choices: option.choices.map(choice => ({
            name: choice.name,
            price: choice.price,
          })),
        };
      });

      return {
        ...menu,
        kategori: menu.category ? menu.category.name : null,
        category: undefined, // Remove the category object
        options: formattedOptions, // Replace with formatted options
      };
    });

    res.json({
      ok: true,
      message: 'Menus retrieved successfully',
      menus: menusWithKategori,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
};

const   getMenuById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const menu = await prisma.menu.findUnique({
      where: {
        id_menu: id,
      },
      include: {
        options: {
          include: {
            choices: true,
          },
        },
      },
    });
    
    if (!menu) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Menu not found',
      })); 
    }

    const category = await prisma.category.findUnique({
      where: {
        id_category: menu.kategoriId,
      },
      select: {
        name: true,
      },
    });

    const formattedOptions = {};
    menu.options.forEach(option => {
      formattedOptions[option.title] = {
        max: option.max,
        optional: option.optional,
        choices: option.choices.map(choice => ({
          name: choice.name,
          price: choice.price,
        })),
      };
    });

    // Combine menu data with the kategori name
    const menuWithKategori = {
      ...menu,
      kategori: category?.name || null,
      category: undefined,
      options: formattedOptions,
    };
    res.json({
      ok: true,
      message: 'Menu retrieved successfully',
      menu: menuWithKategori,
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
    const { nama, deskripsi, harga, kategori, status_stok, jumlah_stok } = req.body;
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

       // Get the category id by the category name (kategoriName)
      const category = await prisma.category.findFirst({
      where: {
        name: kategori,  // Assuming the 'name' field is the category name
      },
    });

    if (!category) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Category not found',
      }));
    }

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

    const useStock = status_stok === 'true' || status_stok === true;
    const stokAwal = useStock ? parseInt(jumlah_stok) || 0 : null;
    const tersedia = useStock ? stokAwal > 0 : true;

    const menu = await prisma.menu.create({
      data: {
        id_menu: newId,
        nama,
        deskripsi,
        harga: parseInt(harga), // Ensure harga is an integer
        kategoriId: category.id_category, // Use the category ID
        image: data.path,
        image_url: imageUrlfilename,
        status_stok: useStock,
        jumlah_stok: stokAwal,
        tersedia,
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
    const  {nama, deskripsi, harga, kategori, status_stok, jumlah_stok } = req.body;
    const getMenu = await prisma.menu.findFirst({
      where: {
        id_menu: id,
      },
    });
    if (!getMenu) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Menu not found',
      }));
    }
    let kategoriId = getMenu.kategoriId;
    let kategoriName = null; // Default to the existing category name
    if (kategori) {
      const getCategory = await prisma.category.findFirst({
        where: { name: kategori },
        select: { id_category: true, name: true },
      });
      if (!getCategory) {
        return next(createError({
          status: BAD_REQUEST,
          message: 'Category not found',
        }));
      }
      kategoriId = getCategory.id_category;
      kategoriName = getCategory?.name || null;
    } else {
      const getCategory = await prisma.category.findUnique({
        where: { id_category: getMenu.kategoriId },
        select: { name: true },
      });
      kategoriName = getCategory?.name || null;
    }

    const useStock = status_stok === 'true' || status_stok === true;
    const stokBaru = useStock ? parseInt(jumlah_stok) || 0 : null;
    const tersedia = useStock ? stokBaru > 0 : true;

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
          kategoriId: kategoriId? kategoriId : getMenu.kategoriId,
          image: data? data.path : "",
          image_url: imageUrlfilename? imageUrlfilename : "",
          status_stok: useStock,
          jumlah_stok: stokBaru,
          tersedia: tersedia,
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
        menu: {
          ...menu,
          kategori: kategoriName, 
          category: undefined,
        },
      });
    } else {
      const menu = await prisma.menu.update({
        where: { id_menu: id },
        data: {
          nama: nama? nama : getMenu.nama,
          deskripsi : deskripsi? deskripsi : getMenu.deskripsi,
          harga: harga? parseInt(harga) : getMenu.harga,
          kategoriId: kategoriId? kategoriId : getMenu.kategoriId,
          status_stok: useStock,
          jumlah_stok: stokBaru,
          tersedia: tersedia,
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
        menu:  {
          ...menu,
          kategori: kategoriName, 
          category: undefined,
        },
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

const stockMenu = async (req, res, next) => {
  const { id } = req.params;
  const { tersedia } = req.body; // Expecting a boolean value (true/false)

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

    const updatedMenu = await prisma.menu.update({
      where: { id_menu: id },
      data: {
        tersedia: Boolean(tersedia), // Ensure the stock value is a boolean
      },
    });

    res.json({
      ok: true,
      message: 'Menu stock updated successfully',
      menu: updatedMenu,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
};

const restockMenu = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { jumlah } = req.body;

    // Validasi input jumlah
    if (jumlah == null || isNaN(jumlah) || jumlah <= 0) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'Jumlah restock harus berupa angka positif',
      }));
    }

    // Cek apakah menu ada
    const menu = await prisma.menu.findUnique({
      where: { id_menu: id },
    });

    if (!menu) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Menu tidak ditemukan',
      }));
    }

    if (!menu.status_stok) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'Menu ini tidak menggunakan sistem stok',
      }));
    }

    const newStock = menu.jumlah_stok + Number(jumlah);

    const updatedMenu = await prisma.menu.update({
      where: { id_menu: id },
      data: {
        jumlah_stok: newStock,
        tersedia: true, // Jika distock ulang, berarti tersedia
      },
    });

    res.status(200).json({
      ok: true,
      message: `Menu '${menu.nama}' berhasil di-restock sebanyak ${jumlah}`,
      data: {
        id: updatedMenu.id_menu,
        nama: updatedMenu.nama,
        jumlah_stok: updatedMenu.jumlah_stok,
        tersedia: updatedMenu.tersedia,
      },
    });
  } catch (err) {
    next(createError({
      status: BAD_REQUEST,
      message: err.message,
    }));
  }
};

const reduceStockMenu = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { jumlah } = req.body;

    // Validasi input jumlah
    if (jumlah == null || isNaN(jumlah) || jumlah <= 0) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'Jumlah pengurangan harus berupa angka positif',
      }));
    }

    // Cek apakah menu ada
    const menu = await prisma.menu.findUnique({
      where: { id_menu: id },
    });

    if (!menu) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Menu tidak ditemukan',
      }));
    }

    if (!menu.status_stok) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'Menu ini tidak menggunakan sistem stok',
      }));
    }

    if (menu.jumlah_stok < Number(jumlah)) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'Stok tidak mencukupi untuk dikurangi',
      }));
    }

    const newStock = menu.jumlah_stok - Number(jumlah);

    const updatedMenu = await prisma.menu.update({
      where: { id_menu: id },
      data: {
        jumlah_stok: newStock,
        tersedia: newStock <= 0 ? false : true, // Jika stok habis, set tersedia ke false
      },
    });

    res.status(200).json({
      ok: true,
      message: `Stok menu '${menu.nama}' berhasil dikurangi sebanyak ${jumlah}`,
      data: {
        id: updatedMenu.id_menu,
        nama: updatedMenu.nama,
        jumlah_stok: updatedMenu.jumlah_stok,
        tersedia: updatedMenu.tersedia,
      },
    });
  } catch (err) {
    next(createError({
      status: BAD_REQUEST,
      message: err.message,
    }));
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany();
    const result = categories.map((item) => {
      return {
        id: item.id_category,
        name: item.name,
        image: item.image_url,
      };
    });
    res.json({
      ok: true,
      message: 'Categories retrieved successfully',
      menu: result,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

const getCategoryById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const category = await prisma.category.findUnique({
      where: {
        id_category: id,
      },
    });
    if (!category) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Category not found',
      }));
    }
    res.json({
      ok: true,
      message: 'Category retrieved successfully',
      category,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

const createCategory = async (req, res, next) => {
  // if (!req.file || !req.file.buffer) {
  //   return next(createError({
  //     status: BAD_REQUEST,
  //     message: 'File upload is required',
  //   }));
  // }

  try {
    const { name } = req.body;
    const file = req.file; // Access the uploaded file
    const fileName = `${createId(6)}.jpg`;

    const { data, error } = await supabaseClient.storage
      .from('category')
      .upload(`public/${fileName}`, file.buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.mimetype,
      });

    let imageUrlfilename;
    if (data) {
      const { data: imageUrl } = await supabaseClient.storage
        .from('category')
        .getPublicUrl(data.path);
      imageUrlfilename = imageUrl.publicUrl;
    }

    if (error) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'File upload failed',
      }));
    }

    const lastCategory = await prisma.category.findFirst({
      orderBy: {
        id_category: 'desc',
      },
    });

    let newId = 'CAR001'; // Initialize newId with a default value
    if (lastCategory) {
      const lastNumber = parseInt(lastCategory.id_category.replace('CAR', '')) || 0; // Ensure lastNumber is defined
      newId = 'CAR' + String(lastNumber + 1).padStart(3, '0'); // Format CARxxx
    }

    const category = await prisma.category.create({
      data: {
        id_category: newId,
        name,
        image: data.path,
        image_url: imageUrlfilename,
      },
    });

    res.json({
      ok: true,
      message: 'Category created successfully',
      category,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
};

const updateCategory = async (req, res, next) => {
  // if (!req.body.menu) {
  //   return next(createError({
  //     status: BAD_REQUEST,
  //     message: 'Menu data is required',
  //   }));
  // }

  try {
    const { id } = req.params;
    const  {name} = req.body;
    const getMenu = await prisma.category.findFirst({
      where: {
        id_category: id,
      },
    });
    if (!getMenuById) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Category not found',
      }));
    }

    const file = req.file; 
    if (file) {
      const fileName = `${createId(6)}.jpg`;

      if (getMenu.image) {
        const { data, error } = await supabaseClient.storage
          .from('category')
          .remove([getMenu.image]);
      }

      const { data, error } = await supabaseClient.storage
        .from('category')
        .upload(`public/${fileName}`, file.buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.mimetype,
        });

        let imageUrlfilename;
      if (data) {
        const {data: imageUrl} = await supabaseClient.storage
          .from('category')
          .getPublicUrl(data.path);
        imageUrlfilename = imageUrl.publicUrl;
      }
      const menu = await prisma.category.update({
        where: { id_category: id },
        data: {
          name: name? name : getMenu.name,
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
      const menu = await prisma.category.update({
        where: { id_category: id },
        data: {
          name: name? name : getMenu.nama,
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

const deleteCategory = async (req, res, next) => {
  const { id } = req.params;
  try {
    const category = await prisma.category.findUnique({
      where: { id_category: id },
    });

    if (!category) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Category not found',
      }));
    }

    await prisma.category.delete({
      where: { id_category: id },
    });

    res.json({
      ok: true,
      message: 'Category deleted successfully',
      category,
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
  stockMenu,
  restockMenu,
  reduceStockMenu,
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};