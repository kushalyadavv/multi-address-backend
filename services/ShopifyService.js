/**
 * Shopify Service
 * 
 * Handles all interactions with Shopify Admin API for multi-address shipping
 */

const axios = require('axios');
const { ApiError } = require('../middleware/errorHandler');

class ShopifyService {
  constructor() {
    this.storeUrl = process.env.SHOPIFY_STORE_URL;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = process.env.SHOPIFY_API_VERSION || '2023-10';
    
    if (!this.storeUrl || !this.accessToken) {
      throw new Error('Shopify configuration is missing. Please set SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN environment variables.');
    }

    this.baseURL = `https://${this.storeUrl}/admin/api/${this.apiVersion}`;
    
    // Create axios instance with default headers
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds timeout
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          console.error('Shopify API Error:', {
            status: error.response.status,
            data: error.response.data,
            url: error.config.url
          });
        }
        throw error;
      }
    );
  }

  /**
   * Get order by ID
   * @param {string|number} orderId - Order ID
   * @returns {Object} Order data
   */
  async getOrder(orderId) {
    try {
      const response = await this.api.get(`/orders/${orderId}.json`);
      return response.data.order;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new ApiError('Order not found', 404);
      }
      throw new ApiError(`Failed to fetch order: ${error.message}`, error.response?.status || 500);
    }
  }

  /**
   * Save address data to order metafields
   * @param {string|number} orderId - Order ID
   * @param {Array} lineItems - Array of line items with addresses
   * @returns {Object} Result object
   */
  async saveAddressesToMetafields(orderId, lineItems) {
    try {
      // Prepare metafield data
      const addressData = {
        multi_address_shipping: {
          configured_at: new Date().toISOString(),
          line_items: lineItems.map(item => ({
            line_item_id: item.line_item_id,
            title: item.title,
            quantity: item.quantity,
            shipping_address: {
              first_name: item.address.first_name,
              last_name: item.address.last_name,
              address1: item.address.address1,
              address2: item.address.address2 || '',
              city: item.address.city,
              province: item.address.province,
              zip: item.address.zip,
              country: item.address.country,
              phone: item.address.phone || ''
            }
          }))
        }
      };

      // Create or update metafield
      const metafield = {
        metafield: {
          namespace: 'multi_address',
          key: 'shipping_addresses',
          value: JSON.stringify(addressData),
          type: 'json'
        }
      };

      const response = await this.api.post(`/orders/${orderId}/metafields.json`, metafield);
      
      // Also add a note to the order
      await this.addOrderNote(orderId, 'Multi-address shipping addresses configured via portal');

      return {
        metafield_id: response.data.metafield.id,
        addresses_saved: lineItems.length,
        saved_at: new Date().toISOString()
      };
    } catch (error) {
      throw new ApiError(`Failed to save addresses to metafields: ${error.message}`, error.response?.status || 500);
    }
  }

  /**
   * Get address data from order metafields
   * @param {string|number} orderId - Order ID
   * @returns {Object} Address data
   */
  async getOrderAddresses(orderId) {
    try {
      const response = await this.api.get(`/orders/${orderId}/metafields.json`);
      const metafields = response.data.metafields;
      
      const addressMetafield = metafields.find(
        mf => mf.namespace === 'multi_address' && mf.key === 'shipping_addresses'
      );

      if (!addressMetafield) {
        return { addresses: [], configured: false };
      }

      const addressData = JSON.parse(addressMetafield.value);
      
      return {
        addresses: addressData.multi_address_shipping.line_items,
        configured: true,
        configured_at: addressData.multi_address_shipping.configured_at,
        metafield_id: addressMetafield.id
      };
    } catch (error) {
      throw new ApiError(`Failed to fetch order addresses: ${error.message}`, error.response?.status || 500);
    }
  }

  /**
   * Update address data in order metafields
   * @param {string|number} orderId - Order ID
   * @param {Array} lineItems - Updated line items with addresses
   * @returns {Object} Result object
   */
  async updateOrderAddresses(orderId, lineItems) {
    try {
      // First, get existing metafield
      const existingAddresses = await this.getOrderAddresses(orderId);
      
      if (!existingAddresses.configured) {
        // If no existing addresses, create new
        return await this.saveAddressesToMetafields(orderId, lineItems);
      }

      // Update existing metafield
      const addressData = {
        multi_address_shipping: {
          configured_at: existingAddresses.configured_at,
          updated_at: new Date().toISOString(),
          line_items: lineItems.map(item => ({
            line_item_id: item.line_item_id,
            title: item.title,
            quantity: item.quantity,
            shipping_address: {
              first_name: item.address.first_name,
              last_name: item.address.last_name,
              address1: item.address.address1,
              address2: item.address.address2 || '',
              city: item.address.city,
              province: item.address.province,
              zip: item.address.zip,
              country: item.address.country,
              phone: item.address.phone || ''
            }
          }))
        }
      };

      const metafieldUpdate = {
        metafield: {
          id: existingAddresses.metafield_id,
          value: JSON.stringify(addressData)
        }
      };

      await this.api.put(`/orders/${orderId}/metafields/${existingAddresses.metafield_id}.json`, metafieldUpdate);

      return {
        metafield_id: existingAddresses.metafield_id,
        addresses_updated: lineItems.length,
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      throw new ApiError(`Failed to update order addresses: ${error.message}`, error.response?.status || 500);
    }
  }

  /**
   * Delete address data from order metafields
   * @param {string|number} orderId - Order ID
   * @returns {Object} Result object
   */
  async deleteOrderAddresses(orderId) {
    try {
      const existingAddresses = await this.getOrderAddresses(orderId);
      
      if (!existingAddresses.configured) {
        return { deleted: false, message: 'No address data found to delete' };
      }

      await this.api.delete(`/orders/${orderId}/metafields/${existingAddresses.metafield_id}.json`);

      return {
        deleted: true,
        metafield_id: existingAddresses.metafield_id,
        deleted_at: new Date().toISOString()
      };
    } catch (error) {
      throw new ApiError(`Failed to delete order addresses: ${error.message}`, error.response?.status || 500);
    }
  }

  /**
   * Split order into multiple orders based on shipping addresses
   * @param {string|number} orderId - Original order ID
   * @param {Array} lineItems - Line items with addresses
   * @returns {Object} Result with created orders
   */
  async splitOrderByAddress(orderId, lineItems) {
    try {
      // Get original order
      const originalOrder = await this.getOrder(orderId);
      
      // Group line items by shipping address
      const addressGroups = this.groupLineItemsByAddress(lineItems);
      
      const createdOrders = [];
      let orderCounter = 1;

      for (const [addressKey, items] of Object.entries(addressGroups)) {
        const address = items[0].address; // All items in group have same address
        
        // Calculate totals for this group
        const groupLineItems = items.map(item => {
          const originalItem = originalOrder.line_items.find(li => li.id === item.line_item_id);
          return {
            variant_id: originalItem.variant_id,
            quantity: item.quantity,
            properties: originalItem.properties || []
          };
        });

        // Create draft order
        const draftOrder = {
          draft_order: {
            line_items: groupLineItems,
            customer: {
              id: originalOrder.customer?.id
            },
            shipping_address: {
              first_name: address.first_name,
              last_name: address.last_name,
              address1: address.address1,
              address2: address.address2,
              city: address.city,
              province: address.province,
              zip: address.zip,
              country: address.country,
              phone: address.phone
            },
            billing_address: originalOrder.billing_address,
            currency: originalOrder.currency,
            note: `Split from order ${originalOrder.name} - Part ${orderCounter}`,
            note_attributes: [
              {
                name: 'original_order_id',
                value: originalOrder.id.toString()
              },
              {
                name: 'split_order_part',
                value: orderCounter.toString()
              },
              {
                name: 'multi_address_split',
                value: 'yes'
              }
            ]
          }
        };

        // Create the draft order
        const draftResponse = await this.api.post('/draft_orders.json', draftOrder);
        const draftOrderId = draftResponse.data.draft_order.id;

        // Complete the draft order (convert to order)
        const completedResponse = await this.api.put(`/draft_orders/${draftOrderId}/complete.json`, {
          payment_pending: false
        });

        createdOrders.push({
          order_id: completedResponse.data.draft_order.order_id,
          draft_order_id: draftOrderId,
          shipping_address: address,
          line_items: items.map(item => ({
            line_item_id: item.line_item_id,
            title: item.title,
            quantity: item.quantity
          }))
        });

        orderCounter++;
      }

      // Add note to original order about the split
      await this.addOrderNote(
        orderId, 
        `Order split into ${createdOrders.length} separate orders: ${createdOrders.map(o => o.order_id).join(', ')}`
      );

      // Mark original order as split
      await this.saveAddressesToMetafields(orderId, lineItems);

      return {
        split_successful: true,
        original_order_id: orderId,
        created_orders: createdOrders,
        total_split_orders: createdOrders.length,
        split_at: new Date().toISOString()
      };
    } catch (error) {
      throw new ApiError(`Failed to split order: ${error.message}`, error.response?.status || 500);
    }
  }

  /**
   * Group line items by shipping address
   * @param {Array} lineItems - Line items with addresses
   * @returns {Object} Grouped line items
   */
  groupLineItemsByAddress(lineItems) {
    const groups = {};
    
    lineItems.forEach(item => {
      const addressKey = [
        item.address.address1,
        item.address.city,
        item.address.province,
        item.address.zip,
        item.address.country
      ].join('|').toLowerCase();
      
      if (!groups[addressKey]) {
        groups[addressKey] = [];
      }
      
      groups[addressKey].push(item);
    });
    
    return groups;
  }

  /**
   * Add a note to an order
   * @param {string|number} orderId - Order ID
   * @param {string} note - Note to add
   * @returns {Object} Updated order
   */
  async addOrderNote(orderId, note) {
    try {
      const order = await this.getOrder(orderId);
      const existingNote = order.note || '';
      const timestamp = new Date().toISOString();
      const newNote = existingNote 
        ? `${existingNote}\n\n[${timestamp}] ${note}`
        : `[${timestamp}] ${note}`;

      const response = await this.api.put(`/orders/${orderId}.json`, {
        order: {
          id: orderId,
          note: newNote
        }
      });

      return response.data.order;
    } catch (error) {
      console.error('Failed to add order note:', error.message);
      // Don't throw error for note addition failures
      return null;
    }
  }

  /**
   * Get all metafields for an order
   * @param {string|number} orderId - Order ID
   * @returns {Array} Metafields
   */
  async getOrderMetafields(orderId) {
    try {
      const response = await this.api.get(`/orders/${orderId}/metafields.json`);
      return response.data.metafields;
    } catch (error) {
      throw new ApiError(`Failed to fetch order metafields: ${error.message}`, error.response?.status || 500);
    }
  }

  /**
   * Test connection to Shopify API
   * @returns {Object} Shop information
   */
  async testConnection() {
    try {
      const response = await this.api.get('/shop.json');
      return {
        connected: true,
        shop: response.data.shop
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = ShopifyService;
