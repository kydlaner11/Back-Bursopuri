const prisma = require('../../database/connection');
const midtransClient = require('midtrans-client');
const { createError, BAD_REQUEST, NOT_FOUND } = require('../helpers/errorHelpers');

const serverKey = process.env.SERVER_KEY;
// const frontendUrl = process.env.FRONT_END_URL || 'http://localhost:3000';
console.log('Server Key:', serverKey);

const snap = new midtransClient.Snap({
  isProduction: false, // ubah ke true saat production
  serverKey: serverKey,
});

// Core API client untuk verifikasi notification
const core = new midtransClient.CoreApi({
  isProduction: false, // ubah ke true saat production
  serverKey: serverKey,
});

const createPayment = async (req, res, next) => {
  try {
    const { orderId, amount, customerDetails } = req.body;

    if (!orderId || !amount || !customerDetails) {
      return next(createError({ status: BAD_REQUEST, message: 'Order ID, amount, and customer details are required' }));
    }

    // console.log(frontendUrl);

    const transactionData = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: customerDetails,
    };

    const transaction = await snap.createTransaction(transactionData);
    
    res.status(200).json({
      ok: true,
      message: 'Payment created successfully',
      data: transaction,
    });
  } catch (error) {
    next(createError({ status: BAD_REQUEST, message: error.message }));
  }
}

const getPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return next(createError({ status: BAD_REQUEST, message: 'Order ID is required' }));
    }

    const status = await core.transaction.status(orderId);
    
    // Optional: Update order status based on current payment status
    const transactionStatus = status.transaction_status;
    const fraudStatus = status.fraud_status;
    
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      if (fraudStatus === 'accept' || !fraudStatus) {
        await updateOrderStatusAfterPayment(orderId, 'IN_PROGRESS');
      }
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
      await updateOrderStatusAfterPayment(orderId, 'CANCELLED');
    }
    
    res.status(200).json({
      ok: true,
      message: 'Payment status fetched successfully',
      data: status,
    });
  } catch (error) {
    next(createError({ status: NOT_FOUND, message: error.message }));
  }
}

const cancelPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return next(createError({ status: BAD_REQUEST, message: 'Order ID is required' }));
    }

    const cancelResponse = await snap.transaction.cancel(orderId);
    
    res.status(200).json({
      ok: true,
      message: 'Payment cancelled successfully',
      data: cancelResponse,
    });
  } catch (error) {
    next(createError({ status: NOT_FOUND, message: error.message }));
  }
}

const handlePaymentNotification = async (req, res, next) => {
  try {
    const notification = req.body;
    
    console.log('Received payment notification:', notification);
    
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    // Verifikasi signature dengan Core API
    let statusResponse;
    try {
      statusResponse = await core.transaction.status(orderId);
    } catch (error) {
      console.error('Error verifying transaction status:', error);
      return next(createError({ status: BAD_REQUEST, message: 'Invalid notification' }));
    }

    console.log(`Transaction notification verified. Order ID: ${orderId}. Transaction status: ${transactionStatus}. Fraud status: ${fraudStatus}`);

    // Update status order berdasarkan status payment
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      if (fraudStatus === 'accept' || !fraudStatus) {
        // Payment berhasil, update status order menjadi IN_PROGRESS
        await updateOrderStatusAfterPayment(orderId, 'IN_PROGRESS');
        console.log(`Order ${orderId} status updated to IN_PROGRESS after successful payment`);
      }
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
      // Payment gagal atau dibatalkan, update status order menjadi CANCELLED
      await updateOrderStatusAfterPayment(orderId, 'CANCELLED');
      console.log(`Order ${orderId} status updated to CANCELLED due to payment failure`);
    } else if (transactionStatus === 'pending') {
      console.log(`Order ${orderId} payment is still pending`);
    }

    res.status(200).json({
      ok: true,
      message: 'Notification processed successfully',
    });
  } catch (error) {
    console.error('Error processing payment notification:', error);
    next(createError({ status: BAD_REQUEST, message: error.message }));
  }
}

const updateOrderStatusAfterPayment = async (orderId, newStatus) => {
  try {
    // Cek apakah order ada
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      }
    });

    if (!order) {
      throw new Error(`Order with ID ${orderId} not found`);
    }

    // Hanya update jika order masih dalam status PENDING
    if (order.status !== 'PENDING') {
      console.log(`Order ${orderId} is not in PENDING status, current status: ${order.status}`);
      return;
    }

    // Update status order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { 
        status: newStatus,
        updatedAt: new Date(),
        ...(newStatus === 'DONE' ? { finishedAt: new Date() } : {})
      },
    });

    // Jika status berubah menjadi IN_PROGRESS, kurangi stok menu (seperti di updateOrderStatus)
    if (newStatus === 'IN_PROGRESS') {
      for (const item of order.items) {
        const menu = await prisma.menu.findUnique({
          where: { id_menu: item.menuId },
          select: { status_stok: true, jumlah_stok: true },
        });

        if (menu?.status_stok) {
          if (menu.jumlah_stok < item.quantity) {
            console.warn(`Insufficient stock for menu '${item.name}'`);
            continue; // Skip stock reduction if insufficient
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

    return updatedOrder;
  } catch (error) {
    console.error('Error updating order status after payment:', error);
    throw error;
  }
}

const syncPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return next(createError({ status: BAD_REQUEST, message: 'Order ID is required' }));
    }

    // Get current payment status from Midtrans
    const paymentStatus = await core.transaction.status(orderId);
    const transactionStatus = paymentStatus.transaction_status;
    const fraudStatus = paymentStatus.fraud_status;

    // Get current order status from database
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true }
    });

    if (!order) {
      return next(createError({ status: NOT_FOUND, message: 'Order not found' }));
    }

    let shouldUpdate = false;
    let newStatus = null;

    // Determine if order status should be updated
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      if ((fraudStatus === 'accept' || !fraudStatus) && order.status === 'PENDING') {
        newStatus = 'IN_PROGRESS';
        shouldUpdate = true;
      }
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
      if (order.status === 'PENDING') {
        newStatus = 'CANCELLED';
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      await updateOrderStatusAfterPayment(orderId, newStatus);
      res.status(200).json({
        ok: true,
        message: `Order status synchronized successfully. Updated to ${newStatus}`,
        data: {
          orderId,
          oldStatus: order.status,
          newStatus,
          paymentStatus: transactionStatus
        }
      });
    } else {
      res.status(200).json({
        ok: true,
        message: 'Order status is already synchronized',
        data: {
          orderId,
          currentStatus: order.status,
          paymentStatus: transactionStatus
        }
      });
    }
  } catch (error) {
    console.error('Error syncing payment status:', error);
    next(createError({ status: BAD_REQUEST, message: error.message }));
  }
}

module.exports = {
  createPayment,
  getPaymentStatus,
  cancelPayment,
  handlePaymentNotification,
  syncPaymentStatus,
};