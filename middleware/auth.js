/**
 * Authentication Middleware
 * 
 * Validates API keys and ensures secure access to the multi-address endpoints
 */

/**
 * Validate API Key middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const expectedApiKey = process.env.API_KEY;

  // Skip validation in development mode if no API key is set
  if (process.env.NODE_ENV === 'development' && !expectedApiKey) {
    console.warn('⚠️  Warning: API key validation is disabled in development mode');
    return next();
  }

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key is required',
      message: 'Please provide an API key in the X-API-Key header or api_key query parameter'
    });
  }

  if (apiKey !== expectedApiKey) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  next();
};

/**
 * Validate Shopify webhook signature (for future webhook implementations)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateShopifyWebhook = (req, res, next) => {
  const crypto = require('crypto');
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.warn('⚠️  Warning: Shopify webhook secret not configured');
    return next();
  }

  const signature = req.headers['x-shopify-hmac-sha256'];
  const body = JSON.stringify(req.body);
  
  if (!signature) {
    return res.status(401).json({
      success: false,
      error: 'Missing webhook signature'
    });
  }

  const calculatedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body, 'utf8')
    .digest('base64');

  if (signature !== calculatedSignature) {
    return res.status(403).json({
      success: false,
      error: 'Invalid webhook signature'
    });
  }

  next();
};

module.exports = {
  validateApiKey,
  validateShopifyWebhook
};
