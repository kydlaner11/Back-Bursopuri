const prisma = require('../../database/connection');
const createId = require('../../utils/createId');
const createIdOrder = require('../../utils/createIdOrder');
const { formatReadableDate } = require('../../utils/date'); // Destructure formatReadableDate
const { createError, BAD_REQUEST, NOT_FOUND } = require('../helpers/errorHelpers');
const supabaseClient = require('../middleware/supabase');


const getOrders = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
       where: {
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'DONE' ]
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!orders) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Pesanan tidak ditemukan',
      }));
    }

    const formattedOrders = orders.map(order => ({
      orderId: order.id,
      tanggalOrder: formatReadableDate(order.createdAt),
      totalOrder: order.total,
      nama: order.customer?.name ?? "-",
      tipeOrder: order.orderType,
      pembayaran: order.paymentMethod,
      antrian: order.queueNumber,
      status: order.status, // jika ada status
      createdAt: order.createdAt,
      tableNumber: order.tableNumber,
      order: order.items.map(item => ({
        namaMenu: item.name,
        jumlah: item.quantity,
        harga: item.price,
        note: item.notes,
        ...(item.options ? { options: item.options } : {}) // hanya jika ada opsi
      }))
    }));

    res.status(201).json({
      ok: true,
      message: 'Order created successfully',
      data: formattedOrders,
    });
  } catch (err) {
    next(createError({ status: BAD_REQUEST, message: err.message }));
  }
};

const getOrderHistory = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: ['DONE', 'CANCELLED']
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!orders || orders.length === 0) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Riwayat pesanan tidak ditemukan',
      }));
    }

    const formattedOrders = orders.map(order => ({
      orderId: order.id,
      tanggalOrder: formatReadableDate(order.createdAt),
      totalOrder: order.total,
      nama: order.customer?.name ?? "-",
      tipeOrder: order.orderType,
      pembayaran: order.paymentMethod,
      antrian: order.queueNumber,
      status: order.status,
      createdAt: order.createdAt,
      tableNumber: order.tableNumber,
      order: order.items.map(item => ({
        namaMenu: item.name,
        jumlah: item.quantity,
        harga: item.price,
        note: item.notes,
        ...(item.options ? { options: item.options } : {})
      }))
    }));

    res.status(200).json({
      ok: true,
      message: 'Berhasil mengambil riwayat pesanan',
      data: formattedOrders,
    });
  } catch (err) {
    next(createError({ status: BAD_REQUEST, message: err.message }));
  }
};

const getOrderProgress = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: ['IN_PROGRESS']
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!orders || orders.length === 0) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Riwayat pesanan tidak ditemukan',
      }));
    }

    const formattedOrders = orders.map(order => ({
      orderId: order.id,
      tanggalOrder: formatReadableDate(order.createdAt),
      totalOrder: order.total,
      nama: order.customer?.name ?? "-",
      tipeOrder: order.orderType,
      pembayaran: order.paymentMethod,
      antrian: order.queueNumber,
      status: order.status,
      createdAt: order.createdAt,
      tableNumber: order.tableNumber,
      order: order.items.map(item => ({
        namaMenu: item.name,
        jumlah: item.quantity,
        harga: item.price,
        note: item.notes,
        ...(item.options ? { options: item.options } : {})
      }))
    }));

    res.status(200).json({
      ok: true,
      message: 'Berhasil mengambil riwayat pesanan',
      data: formattedOrders,
    });
  } catch (err) {
    next(createError({ status: BAD_REQUEST, message: err.message }));
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { id: orderId } = req.params;
    const { action } = req.body;

    // Validasi action
    const validActions = ['pending_to_progress', 'progress_to_done', 'pending_to_cancelled', 'progress_to_cancelled'];
    if (!validActions.includes(action)) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'Aksi tidak valid',
      }));
    }

    // Cek apakah pesanan ada
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Pesanan tidak ditemukan',
      }));
    }

    let newStatus;
    let statusValid = false;

    // Tentukan status baru berdasarkan aksi
    switch (action) {
      case 'pending_to_progress':
        if (order.status === 'PENDING') {
          newStatus = 'IN_PROGRESS';
          statusValid = true;

          const orderItems = await prisma.orderItem.findMany({
            where: { orderId },
          });

          for (const item of orderItems) {
            const menu = await prisma.menu.findUnique({
              where: { id_menu: item.menuId },
              select: { status_stok: true, jumlah_stok: true },
            });

            if (menu?.status_stok) {
              if (menu.jumlah_stok < item.quantity) {
                return next(createError({
                  status: BAD_REQUEST,
                  message: `Stok untuk menu '${item.name}' tidak mencukupi.`,
                }));
              }

              await prisma.menu.update({
                where: { id_menu: item.menuId },
                data: {
                  jumlah_stok: menu.jumlah_stok - item.quantity,
                  tersedia: menu.jumlah_stok - item.quantity > 0,
                },
              });
            }
          }
        }
        break;
      case 'progress_to_done':
        if (order.status === 'IN_PROGRESS') {
          newStatus = 'DONE';
          statusValid = true;
        }
        break;
      case 'pending_to_cancelled':
        if (order.status === 'PENDING') {
          newStatus = 'CANCELLED';
          statusValid = true;
        }
        break;
      case 'progress_to_cancelled':
        if (order.status === 'IN_PROGRESS') {
          newStatus = 'CANCELLED';
          statusValid = true;
        }
        break;
    }

    if (!statusValid) {
      return next(createError({
        status: BAD_REQUEST,
        message: `Tidak dapat mengubah status dari ${order.status} dengan aksi ${action}`,
      }));
    }

    // Update status pesanan
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: {
        items: true,
        customer: true,
      },
    });

    const formattedOrder = {
      orderId: updatedOrder.id,
      tanggalOrder: formatReadableDate(updatedOrder.createdAt),
      totalOrder: updatedOrder.total,
      nama: updatedOrder.customer?.name ?? "-",
      tipeOrder: updatedOrder.orderType,
      pembayaran: updatedOrder.paymentMethod,
      antrian: updatedOrder.queueNumber,
      status: updatedOrder.status,
      createdAt: updatedOrder.createdAt,
      tableNumber: updatedOrder.tableNumber,
      order: updatedOrder.items.map(item => ({
        namaMenu: item.name,
        jumlah: item.quantity,
        harga: item.price,
        note: item.notes,
        ...(item.options ? { options: item.options } : {})
      }))
    };

    res.status(200).json({
      ok: true,
      message: `Status pesanan berhasil diubah dari ${order.status} menjadi ${newStatus}`,
      data: formattedOrder,
    });
  } catch (err) {
    next(createError({ status: BAD_REQUEST, message: err.message }));
  }
};  


const getOrderStatusById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }

    res.json({
      ok: true,
      data: {
        orderId: order.id,
        status: order.status,
      },
    });
  } catch (err) {
    next(createError({ status: 500, message: err.message }));
  }
};

const formatOrders = (orders) => {
  return orders.map(order => {
    // Format tanggal dan waktu
    const orderDate = new Date(order.createdAt);
    const date = orderDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const time = orderDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: 'numeric', 
      hour12: true 
    });

    return {
      id: order.id,
      date,
      time,
      queueNumber: order.queueNumber,
      status: order.status.toLowerCase(),
      total: parseFloat(order.total),
      products: order.items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        ...(item.notes ? { notes: item.notes } : {}),
        ...(item.options ? { options: item.options } : {})
      }))
    };
  });
};

const getOrderHistorybySession = async (req, res, next) => {
  try {
    // Opsi 1: Menggunakan query parameter (/?sessionId=abc123)
     const { sessionId } = req.params;
    
    if (!sessionId) {
      return next(createError({
        status: BAD_REQUEST, 
        message: 'SessionId diperlukan sebagai query parameter'
      }));
    }

    const orders = await prisma.order.findMany({
      where: {
        sessionId,
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'DONE']
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!orders || orders.length === 0) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Pesanan tidak ditemukan',
      }));
    }

    // Menggunakan fungsi helper untuk format respons
    const formattedOrders = formatOrders(orders);

    res.status(200).json({
      ok: true,
      message: 'Order history retrieved successfully',
      orders: formattedOrders,
    });
  } catch (err) {
    next(createError({ status: BAD_REQUEST, message: err.message }));
  }
};


const createOrder = async (req, res, next) => {
  try {
    const { orderType, paymentMethod, subtotal, total, tableNumber, customer, items, sessionId } = req.body;

    // Validate required fields
    if (!orderType || !paymentMethod || !Array.isArray(items) || items.length === 0) {
      return next(createError({ status: BAD_REQUEST, message: 'Invalid input' }));
    }
    
    // Find the last order of the day to calculate next queue number
    const lastOrder = await prisma.order.findFirst({
      orderBy: { queueNumber: 'desc' },
    });
    const newQueueNumber = lastOrder ? lastOrder.queueNumber + 1 : 100;

    // Handle customer creation or retrieval
    let customerId = null;
    if (customer && customer.phone) {
      const existingCustomer = await prisma.customer.findFirst({
        where: { phone: customer.phone }
      });

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // Create new customer with a unique ID
        let newCustomerId;
        do {
          newCustomerId = await createIdOrder('CUS');
          const existingCustomer = await prisma.customer.findUnique({ 
            where: { id: newCustomerId }
          });
          if (!existingCustomer) break;
        } while (true);
        
        const newCustomer = await prisma.customer.create({
          data: {
            id: newCustomerId,
            name: customer.name,
            phone: customer.phone,
            email: customer.email || null,
          },
        });
        customerId = newCustomer.id;
      }
    }

    // Generate a unique order ID based on a shorter timestamp
    let orderId;
    do {
      orderId = `${Date.now()}`
      const existingOrder = await prisma.order.findFirst({
        where: { id: orderId },
      });
      if (!existingOrder) break; // Exit loop if ID is unique
    } while (true);

    const orderItemsData = items.map((item, index) => {
      const orderItemId = `${orderId}-ITEM${String(index + 1).padStart(2, '0')}`;
      return {
        id: orderItemId,
        menuId: item.menuId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes || null,
        options: item.options || [],
      };
    });

    const order = await prisma.order.create({
      data: {
        id: orderId,
        sessionId,
        queueNumber: newQueueNumber,
        orderType,
        paymentMethod,
        tableNumber,
        customerId,
        subtotal,
        total,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });

    res.status(201).json({
      ok: true,
      message: 'Order created successfully',
      data: {
        ...order,
        createdAtFormatted: formatReadableDate(order.createdAt),
      }
    });
  } catch (err) {
    next(createError({ status: BAD_REQUEST, message: err.message }));
  }
};

const getOnboarding = async (req, res, next) => {
  try {
    const onboarding = await prisma.onboarding.findMany();
    const result = onboarding.map((item) => {
      return {
        id: item.id,
        title1: item.title1,
        title2: item.title2,
        image: item.image_url,
        description1: item.description1,
        description2: item.description2,
      };
    });
    res.json({
      ok: true,
      message: 'Onboarding retrieved successfully',
      onboarding: result,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

const createOnboarding = async (req, res, next) => {
  try {
    const { title1, title2, description1, description2 } = req.body;
    const file = req.file; // Access the first file in the array
    const fileName = `${createId(6)}.jpg`;

    const { data, error } = await supabaseClient.storage
      .from('onboarding')
      .upload(`public/${fileName}`, file.buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.mimetype,
      });

    let imageUrlfilename;
    if (data) {
      const { data: imageUrl } = await supabaseClient.storage
        .from('onboarding')
        .getPublicUrl(data.path);
      imageUrlfilename = imageUrl.publicUrl;
    }

    if (error) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'File upload failed',
      }));
    }

    const lastOnboarding = await prisma.onboarding.findFirst({
      orderBy: {
        id: 'desc',
      },
    });

    const newId = lastOnboarding ? lastOnboarding.id + 1 : 1;

    const onboarding = await prisma.onboarding.create({
      data: {
        id: newId,
        title1,
        title2,
        image: data.path,
        image_url: imageUrlfilename,
        description1,
        description2,
      },
    });

    res.json({
      ok: true,
      message: 'Onboarding created successfully',
      onboarding,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

const getCarousel = async (req, res) => {
  try {
    const carousel = await prisma.carousel.findMany();
    const result = carousel.map((item) => {
      return {
        id: item.id,
        banner: item.image_url,
      };
    });
    res.json({
      ok: true,
      message: 'Onboarding retrieved successfully',
      carousel: result,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

const createCarousel = async (req, res, next) => {
  try {
    const file = req.file; // Access the first file in the array
    const fileName = `${createId(6)}.jpg`;

    const { data, error } = await supabaseClient.storage
      .from('onboarding')
      .upload(`public/${fileName}`, file.buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.mimetype,
      });

    let imageUrlfilename;
    if (data) {
      const { data: imageUrl } = await supabaseClient.storage
        .from('onboarding')
        .getPublicUrl(data.path);
      imageUrlfilename = imageUrl.publicUrl;
    }

    if (error) {
      return next(createError({
        status: BAD_REQUEST,
        message: 'File upload failed',
      }));
    }

    const lastcarousel = await prisma.carousel.findFirst({
      orderBy: {
        id: 'desc',
      },
    });

    const newId = lastcarousel ? lastcarousel.id + 1 : 1;

    const carousel = await prisma.carousel.create({
      data: {
        id: newId,
        image: data.path,
        image_url: imageUrlfilename,
      },
    });

    res.json({
      ok: true,
      message: 'carousel created successfully',
      carousel,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

const deleteCarousel = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Cek apakah carousel ada
    const carousel = await prisma.carousel.findUnique({
      where: { id: Number(id) },
    });

    if (!carousel) {
      return next(createError({
        status: NOT_FOUND,
        message: 'Carousel tidak ditemukan',
      }));
    }

    // Hapus carousel
    await prisma.carousel.delete({
      where: { id: Number(id) },
    });

    res.json({
      ok: true,
      message: 'Carousel berhasil dihapus',
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
}

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

    const result = menus.map((item) => {
      // Format options for this specific menu
      const formattedOptions = {};
      if (item.options && item.options.length > 0) {
        item.options.forEach(option => {
          formattedOptions[option.title] = {
            max: option.max,
            optional: option.optional,
            choices: option.choices.map(choice => ({
              name: choice.name,
              price: choice.price,
            })),
          };
        });
      }

      return {
        id: item.id_menu,
        name: item.nama,
        price: item.harga,
        weight: 250, // default: 250g
        kcal: 180, // default: 180 kcal
        image: item.image_url,
        images: [
          item.image_url,
          item.image_url,
          item.image_url
        ],
        description: item.deskripsi,
        dietaryPreferences: [
          "Low Sugar",
          "No Preservatives"
        ],
        rating: "5.0", // default rating
        isRecommended: true,
        tersedia: item.tersedia,
        isNew: false,
        isHot: false,
        isReady: item.tersedia,
        stock: item.jumlah_stok,
        menu: [item.category?.name || "Uncategorized"],
        option: formattedOptions,
      };
    });

    res.json({
      ok: true,
      message: 'Dishes retrieved successfully',
      dishes: result,
    });
  } catch (error) {
    next(createError({
      status: BAD_REQUEST,
      message: error.message,
    }));
  }
};

module.exports = {
  getOrders,
  getOrderHistory,
  getOrderProgress,
  updateOrderStatus,
  getOrderStatusById,
  getOrderHistorybySession,
  createOrder,
  getOnboarding,
  createOnboarding,
  getCarousel,
  createCarousel,
  getMenus,
  deleteCarousel, // tambahkan ekspor fungsi deleteCarousel
};