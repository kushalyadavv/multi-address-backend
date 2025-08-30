# Dancing Deer Multi-Address Backend API

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp config.example.env .env
   # Edit .env with your Shopify credentials
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Test API**
   ```bash
   curl http://localhost:3000/health
   ```

## API Endpoints

### Health Check
```
GET /health
GET /health/detailed
GET /health/ready
GET /health/live
```

### Multi-Address Operations
```
GET  /api/multi-address/order/:orderId
POST /api/multi-address/save
GET  /api/multi-address/addresses/:orderId
PUT  /api/multi-address/addresses/:orderId
DELETE /api/multi-address/addresses/:orderId
POST /api/multi-address/validate-address
```

## Environment Variables

```bash
# Required
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_token
SHOPIFY_API_VERSION=2023-10

# Optional
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=https://your-store.com
API_KEY=your_api_key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Development

```bash
# Install dependencies
npm install

# Start with hot reload
npm run dev

# Run tests
npm test

# Start production
npm start
```

## Deployment

### Heroku
```bash
heroku create your-app-name
git push heroku main
heroku config:set SHOPIFY_STORE_URL=your-store.myshopify.com
heroku config:set SHOPIFY_ACCESS_TOKEN=your_token
```

### Vercel
```bash
vercel --prod
```

### Docker
```bash
docker build -t dancing-deer-api .
docker run -p 3000:3000 dancing-deer-api
```

## Security

- API key authentication required
- Rate limiting enabled
- CORS configured
- Input validation with Joi
- Helmet.js security headers

## Support

For issues or questions, contact the development team.
