const prisma = require('../../database/connection');
const createId = require('../../utils/createId');
const { createError, BAD_REQUEST, NOT_FOUND } = require('../helpers/errorHelpers');
// const supabaseClient = require('../middleware/supabase');

const createMenuOption = async (req, res, next) => {
  try {
    const { title, optional, max, choices, menuIds } = req.body;

    if (!title || typeof optional !== 'boolean' || typeof max !== 'number' || !Array.isArray(choices) || !Array.isArray(menuIds)) {
      return next(createError({ status: BAD_REQUEST, message: 'Invalid request body' }));
    }

    // Fetch the last created menu option
    const lastMenu = await prisma.menuOption.findFirst({
      orderBy: { id: 'desc' },
    });

    let newId = 'OPT001'; // Initialize newId with a default value
    if (lastMenu) {
      const lastNumber = parseInt(lastMenu.id.replace('OPT', '')) || 0; // Ensure lastNumber is defined
      newId = 'OPT' + String(lastNumber + 1).padStart(3, '0'); // Format OPTxxx
    }

    const menuOption = await prisma.menuOption.create({
      data: {
        id : newId,
        title,
        optional,
        max,
        choices: {
          create: choices.map((choice, index) => ({
            id: `CHO${newId.slice(3)}${String(index + 1).padStart(2, '0')}`,
            name: choice.name,
            price: choice.price,
          })),
        },
        menus: {
          connect: menuIds.map(Id => ({ id_menu: Id })), 
        },
      },
      include: {
        choices: true,
        menus: true,
      },
    });

    res.status(201).json({
      ok: true,
      message: 'Menu Option created successfully',
      data: menuOption,
    });
  } catch (error) {
    next(createError({ status: BAD_REQUEST, message: error.message }));
  }
};

const getMenuOptions = async (req, res, next) => {
  try {
    const menuOptions = await prisma.menuOption.findMany({
      include: {
        choices: true,
        menus: true,
      },
    });
    res.status(200).json({
      ok: true,
      message: 'Menu Options fetched successfully',
      data: menuOptions,
    });
  } catch (error) {
    next(createError({ status: BAD_REQUEST, message: error.message }));
  }
};

const editMenuOption = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, optional, max, choices, menuIds } = req.body;

    if (!id || !title || typeof optional !== 'boolean' || typeof max !== 'number' || !Array.isArray(choices) || !Array.isArray(menuIds)) {
      return next(createError({ status: BAD_REQUEST, message: 'Invalid request body' }));
    }

    // Cek apakah menu option ada
    const menuOption = await prisma.menuOption.findUnique({
      where: { id },
      include: { choices: true, menus: true },
    });
    if (!menuOption) {
      return next(createError({ status: NOT_FOUND, message: 'Menu Option not found' }));
    }

    // Update menu option
    const updatedMenuOption = await prisma.menuOption.update({
      where: { id },
      data: {
        title,
        optional,
        max,
        // Hapus semua choices lama, lalu buat ulang
        choices: {
          deleteMany: {},
          create: choices.map((choice, index) => ({
            id: `CHO${id.slice(3)}${String(index + 1).padStart(2, '0')}`,
            name: choice.name,
            price: choice.price,
          })),
        },
        // Update relasi menus
        menus: {
          set: [], // hapus semua relasi lama
          connect: menuIds.map(menuId => ({ id_menu: menuId })),
        },
      },
      include: {
        choices: true,
        menus: true,
      },
    });

    res.status(200).json({
      ok: true,
      message: 'Menu Option updated successfully',
      data: updatedMenuOption,
    });
  } catch (error) {
    next(createError({ status: BAD_REQUEST, message: error.message }));
  }
};

const getOptionsById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(createError({ status: BAD_REQUEST, message: 'ID is required' }));
    }
    const menuOption = await prisma.menuOption.findUnique({
      where: { id },
      include: {
        choices: true,
        menus: true,
      },
    });
    if (!menuOption) {
      return next(createError({ status: NOT_FOUND, message: 'Menu Option not found' }));
    }
    res.status(200).json({
      ok: true,
      message: 'Menu Option fetched successfully',
      data: menuOption,
    });
  } catch (error) {
    next(createError({ status: BAD_REQUEST, message: error.message }));
  }
};

const deleteMenuOption = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(createError({ status: BAD_REQUEST, message: 'ID is required' }));
    }

    // Pastikan menu option ada
    const menuOption = await prisma.menuOption.findUnique({
      where: { id },
    });
    if (!menuOption) {
      return next(createError({ status: NOT_FOUND, message: 'Menu Option not found' }));
    }

    // Hapus menu option (beserta choices dan relasi menus jika ada cascading)
    await prisma.menuOption.delete({
      where: { id },
    });

    res.status(200).json({
      ok: true,
      message: 'Menu Option deleted successfully',
    });
  } catch (error) {
    next(createError({ status: BAD_REQUEST, message: error.message }));
  }
};

module.exports = {
  createMenuOption,
  getMenuOptions,
  editMenuOption,
  getOptionsById,
  deleteMenuOption,
};
