import swaggerAutogen from 'swagger-autogen';
import fs from 'fs';

const doc = {
  info: {
    title: 'ICS-Guard API Documentation',
    description: 'API Document for ICS-Guard System (Industrial Control Systems Security Guard)',
    version: '1.0.0',
  },
  servers: [
    {
      url: 'http://localhost:8000',
      description: 'Development Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token in format: Bearer <token>',
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
};

const outputFile = './swagger-output.json';
const routes = ['./src/app.js'];

swaggerAutogen({ openapi: '3.0.0' })(outputFile, routes, doc).then(() => {
  // Post-process to add auto-tags based on URL paths
  const rawData = fs.readFileSync(outputFile, 'utf8');
  const swaggerData = JSON.parse(rawData);

  if (swaggerData.paths) {
    for (const [path, methods] of Object.entries(swaggerData.paths)) {
      // Filter out redundant auth aliases
      if (path.startsWith('/api/v1/auth') || path.startsWith('/v1/auth') || path.startsWith('/auth')) {
        delete swaggerData.paths[path];
        continue;
      }

      // Extract the first meaningful part of the path, e.g., /api/users/login -> users
      const parts = path.split('/').filter(Boolean);
      let tag = 'Default';
      if (parts.length > 0) {
        if (parts[0] === 'api' && parts.length > 1) {
          if (parts[1] === 'v1' && parts.length > 2) tag = parts[2];
          else tag = parts[1];
        } else {
          tag = parts[0];
        }
      }
      
      // Capitalize the tag
      tag = tag.charAt(0).toUpperCase() + tag.slice(1);
      
      for (const [method, details] of Object.entries(methods)) {
        if (!details.tags || details.tags.length === 0) {
          details.tags = [tag];
        }

        // Automatically inject common query parameters for GET list endpoints
        if (method === 'get' && !path.includes('{')) {
          const defaultFilters = [
            { name: 'page', in: 'query', description: 'Page number', required: false, schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', description: 'Items per page', required: false, schema: { type: 'integer', default: 10 } },
            { name: 'search', in: 'query', description: 'Search keyword', required: false, schema: { type: 'string' } },
            { name: 'sortBy', in: 'query', description: 'Sort by field', required: false, schema: { type: 'string' } },
            { name: 'sortOrder', in: 'query', description: 'Sort order (asc/desc)', required: false, schema: { type: 'string', enum: ['asc', 'desc'] } }
          ];

          if (!details.parameters) details.parameters = [];
          
          const existingParams = new Set(details.parameters.map(p => p.name));
          for (const param of defaultFilters) {
            if (!existingParams.has(param.name)) {
              details.parameters.push(param);
            }
          }
        }
      }
    }
    
    // Write back the modified JSON
    fs.writeFileSync(outputFile, JSON.stringify(swaggerData, null, 2), 'utf8');
  }

  console.log('Swagger documentation generated and grouped successfully.');
});
