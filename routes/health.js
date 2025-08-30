/**
 * Health Check Routes
 * 
 * Provides health check endpoints for monitoring the API status
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

/**
 * Basic health check
 * GET /health
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Dancing Deer Multi-Address API is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: require('../package.json').version
  });
});

/**
 * Detailed health check including Shopify connectivity
 * GET /health/detailed
 */
router.get('/detailed', async (req, res) => {
  const healthCheck = {
    success: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: require('../package.json').version,
    services: {
      api: 'healthy',
      shopify: 'unknown'
    },
    memory: process.memoryUsage(),
    uptime: process.uptime()
  };

  // Check Shopify API connectivity
  try {
    if (process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN) {
      const shopifyResponse = await axios.get(
        `https://${process.env.SHOPIFY_STORE_URL}/admin/api/${process.env.SHOPIFY_API_VERSION || '2023-10'}/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      if (shopifyResponse.status === 200) {
        healthCheck.services.shopify = 'healthy';
        healthCheck.shopify = {
          store_name: shopifyResponse.data.shop.name,
          domain: shopifyResponse.data.shop.domain,
          plan: shopifyResponse.data.shop.plan_name
        };
      }
    } else {
      healthCheck.services.shopify = 'not_configured';
    }
  } catch (error) {
    healthCheck.services.shopify = 'unhealthy';
    healthCheck.shopifyError = error.message;
    healthCheck.success = false;
  }

  const statusCode = healthCheck.success ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

/**
 * Readiness probe
 * GET /health/ready
 */
router.get('/ready', (req, res) => {
  // Check if all required environment variables are set
  const requiredEnvVars = [
    'SHOPIFY_STORE_URL',
    'SHOPIFY_ACCESS_TOKEN'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    return res.status(503).json({
      success: false,
      message: 'Service not ready',
      missingEnvironmentVariables: missingVars
    });
  }

  res.json({
    success: true,
    message: 'Service is ready',
    timestamp: new Date().toISOString()
  });
});

/**
 * Liveness probe
 * GET /health/live
 */
router.get('/live', (req, res) => {
  res.json({
    success: true,
    message: 'Service is alive',
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
});

module.exports = router;
