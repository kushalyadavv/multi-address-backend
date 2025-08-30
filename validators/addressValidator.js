/**
 * Address Validation
 * 
 * Validates address data for multi-address shipping requests
 */

const Joi = require('joi');

/**
 * Address schema validation
 */
const addressSchema = Joi.object({
  first_name: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.empty': 'First name is required',
      'string.max': 'First name must be less than 50 characters'
    }),
  
  last_name: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Last name is required',
      'string.max': 'Last name must be less than 50 characters'
    }),
  
  address1: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Address line 1 is required',
      'string.max': 'Address line 1 must be less than 100 characters'
    }),
  
  address2: Joi.string()
    .trim()
    .max(100)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Address line 2 must be less than 100 characters'
    }),
  
  city: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.empty': 'City is required',
      'string.max': 'City must be less than 50 characters'
    }),
  
  province: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.empty': 'State/Province is required',
      'string.max': 'State/Province must be less than 50 characters'
    }),
  
  zip: Joi.string()
    .trim()
    .min(1)
    .max(20)
    .required()
    .messages({
      'string.empty': 'ZIP/Postal code is required',
      'string.max': 'ZIP/Postal code must be less than 20 characters'
    }),
  
  country: Joi.string()
    .trim()
    .min(2)
    .max(2)
    .uppercase()
    .required()
    .messages({
      'string.empty': 'Country is required',
      'string.length': 'Country must be a 2-letter country code (e.g., US, CA)'
    }),
  
  phone: Joi.string()
    .trim()
    .max(20)
    .optional()
    .allow('')
    .pattern(/^[\+]?[\d\s\-\(\)\.]+$/)
    .messages({
      'string.max': 'Phone number must be less than 20 characters',
      'string.pattern.base': 'Phone number format is invalid'
    })
});

/**
 * Line item with address schema
 */
const lineItemSchema = Joi.object({
  line_item_id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Line item ID must be a number',
      'number.positive': 'Line item ID must be positive',
      'any.required': 'Line item ID is required'
    }),
  
  title: Joi.string()
    .trim()
    .optional()
    .messages({
      'string.base': 'Title must be a string'
    }),
  
  quantity: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Quantity must be a number',
      'number.positive': 'Quantity must be positive',
      'any.required': 'Quantity is required'
    }),
  
  address: addressSchema.required()
});

/**
 * Main validation schema for address data submission
 */
const addressDataSchema = Joi.object({
  order_id: Joi.alternatives()
    .try(
      Joi.number().integer().positive(),
      Joi.string().pattern(/^\d+$/)
    )
    .required()
    .messages({
      'alternatives.match': 'Order ID must be a valid number',
      'any.required': 'Order ID is required'
    }),
  
  save_method: Joi.string()
    .valid('metafields', 'split_orders')
    .default('metafields')
    .messages({
      'any.only': 'Save method must be either "metafields" or "split_orders"'
    }),
  
  line_items: Joi.array()
    .items(lineItemSchema)
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one line item is required',
      'any.required': 'Line items are required'
    })
});

/**
 * Validate address data
 * @param {Object} data - Address data to validate
 * @returns {Object} Validation result
 */
const validateAddressData = (data) => {
  return addressDataSchema.validate(data, { 
    abortEarly: false,
    stripUnknown: true
  });
};

/**
 * Validate single address
 * @param {Object} address - Address to validate
 * @returns {Object} Validation result
 */
const validateAddress = (address) => {
  return addressSchema.validate(address, { 
    abortEarly: false,
    stripUnknown: true
  });
};

/**
 * Validate line item with address
 * @param {Object} lineItem - Line item to validate
 * @returns {Object} Validation result
 */
const validateLineItem = (lineItem) => {
  return lineItemSchema.validate(lineItem, { 
    abortEarly: false,
    stripUnknown: true
  });
};

/**
 * Custom validation for specific countries
 * @param {Object} address - Address to validate
 * @returns {Object} Validation result with country-specific rules
 */
const validateAddressWithCountryRules = (address) => {
  const { error, value } = validateAddress(address);
  
  if (error) {
    return { error, value };
  }

  const countrySpecificValidation = {
    US: {
      zipPattern: /^\d{5}(-\d{4})?$/,
      zipMessage: 'US ZIP code must be in format 12345 or 12345-6789'
    },
    CA: {
      zipPattern: /^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$/,
      zipMessage: 'Canadian postal code must be in format A1A 1A1'
    }
  };

  const countryRules = countrySpecificValidation[value.country];
  
  if (countryRules && !countryRules.zipPattern.test(value.zip)) {
    return {
      error: {
        details: [{
          message: countryRules.zipMessage,
          path: ['zip'],
          type: 'string.pattern.base'
        }]
      },
      value
    };
  }

  return { error: null, value };
};

module.exports = {
  validateAddressData,
  validateAddress,
  validateLineItem,
  validateAddressWithCountryRules,
  addressSchema,
  lineItemSchema,
  addressDataSchema
};
