/**
 * Multi-Address Routes
 * 
 * Handles multi-address shipping requests and integrates with Shopify Admin API
 */

const express = require('express');
const Joi = require('joi');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const ShopifyService = require('../services/ShopifyService');
const { validateAddressData } = require('../validators/addressValidator');

const router = express.Router();

/**
 * Get order details for multi-address portal
 * GET /api/multi-address/order/:orderId
 */
router.get('/order/:orderId', asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  
  if (!orderId) {
    throw new ApiError('Order ID is required', 400);
  }

  try {
    const shopifyService = new ShopifyService();
    const order = await shopifyService.getOrder(orderId);
    
    // Check if order has multi-address attribute
    if (!order.note_attributes?.find(attr => attr.name === 'multi_address_shipping' && attr.value === 'yes')) {
      throw new ApiError('This order is not configured for multi-address shipping', 400);
    }

    // Filter only items that require shipping
    const shippableItems = order.line_items.filter(item => item.requires_shipping);

    const orderData = {
      id: order.id,
      number: order.order_number,
      name: order.name,
      total_price: order.total_price,
      currency: order.currency,
      created_at: order.created_at,
      customer: {
        id: order.customer?.id,
        email: order.customer?.email,
        first_name: order.customer?.first_name,
        last_name: order.customer?.last_name
      },
      line_items: shippableItems.map(item => ({
        id: item.id,
        variant_id: item.variant_id,
        product_id: item.product_id,
        title: item.title,
        variant_title: item.variant_title,
        quantity: item.quantity,
        price: item.price,
        total_discount: item.total_discount,
        properties: item.properties,
        image: item.image || null
      })),
      shipping_address: order.shipping_address,
      billing_address: order.billing_address
    };

    res.json({
      success: true,
      data: orderData
    });
  } catch (error) {
    if (error.response?.status === 404) {
      throw new ApiError('Order not found', 404);
    }
    throw error;
  }
}));

/**
 * Save multi-address shipping data
 * POST /api/multi-address/save
 */
router.post('/save', asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = validateAddressData(req.body);
  if (error) {
    throw new ApiError(`Validation error: ${error.details.map(d => d.message).join(', ')}`, 400);
  }

  const { order_id, line_items, save_method } = value;

  try {
    const shopifyService = new ShopifyService();
    
    // Verify order exists and has multi-address shipping enabled
    const order = await shopifyService.getOrder(order_id);
    
    if (!order.note_attributes?.find(attr => attr.name === 'multi_address_shipping' && attr.value === 'yes')) {
      throw new ApiError('This order is not configured for multi-address shipping', 400);
    }

    let result;
    
    if (save_method === 'split_orders') {
      // Option 1: Split into multiple orders
      result = await shopifyService.splitOrderByAddress(order_id, line_items);
    } else {
      // Option 2: Save as metafields (default)
      result = await shopifyService.saveAddressesToMetafields(order_id, line_items);
    }

    res.json({
      success: true,
      message: 'Multi-address shipping data saved successfully',
      data: result
    });
  } catch (error) {
    if (error.response?.status === 404) {
      throw new ApiError('Order not found', 404);
    }
    throw error;
  }
}));

/**
 * Get saved address data for an order
 * GET /api/multi-address/addresses/:orderId
 */
router.get('/addresses/:orderId', asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  
  if (!orderId) {
    throw new ApiError('Order ID is required', 400);
  }

  try {
    const shopifyService = new ShopifyService();
    const addresses = await shopifyService.getOrderAddresses(orderId);

    res.json({
      success: true,
      data: addresses
    });
  } catch (error) {
    if (error.response?.status === 404) {
      throw new ApiError('Order not found', 404);
    }
    throw error;
  }
}));

/**
 * Update address data for specific line items
 * PUT /api/multi-address/addresses/:orderId
 */
router.put('/addresses/:orderId', asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  
  if (!orderId) {
    throw new ApiError('Order ID is required', 400);
  }

  const { error, value } = validateAddressData(req.body);
  if (error) {
    throw new ApiError(`Validation error: ${error.details.map(d => d.message).join(', ')}`, 400);
  }

  try {
    const shopifyService = new ShopifyService();
    const result = await shopifyService.updateOrderAddresses(orderId, value.line_items);

    res.json({
      success: true,
      message: 'Address data updated successfully',
      data: result
    });
  } catch (error) {
    if (error.response?.status === 404) {
      throw new ApiError('Order not found', 404);
    }
    throw error;
  }
}));

/**
 * Delete address data for an order
 * DELETE /api/multi-address/addresses/:orderId
 */
router.delete('/addresses/:orderId', asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  
  if (!orderId) {
    throw new ApiError('Order ID is required', 400);
  }

  try {
    const shopifyService = new ShopifyService();
    await shopifyService.deleteOrderAddresses(orderId);

    res.json({
      success: true,
      message: 'Address data deleted successfully'
    });
  } catch (error) {
    if (error.response?.status === 404) {
      throw new ApiError('Order not found', 404);
    }
    throw error;
  }
}));

/**
 * Validate address format
 * POST /api/multi-address/validate-address
 */
router.post('/validate-address', asyncHandler(async (req, res) => {
  const addressSchema = Joi.object({
    first_name: Joi.string().required(),
    last_name: Joi.string().required(),
    address1: Joi.string().required(),
    address2: Joi.string().optional().allow(''),
    city: Joi.string().required(),
    province: Joi.string().required(),
    zip: Joi.string().required(),
    country: Joi.string().required(),
    phone: Joi.string().optional().allow('')
  });

  const { error, value } = addressSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid address format',
      details: error.details.map(d => d.message)
    });
  }

  // Optional: Add additional address validation logic here
  // (e.g., postal code format validation, address verification services)

  res.json({
    success: true,
    message: 'Address format is valid',
    address: value
  });
}));

module.exports = router;
