// File: swagger.ts (create this in your project root or config folder)

import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Toprak API Documentation",
    version: "1.0.0",
    description: "Interactive API documentation for Toprak backend routes",
  },
  servers: [
    {
      url: "http://localhost:8000/api",
      description: "Development server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Toprak API Documentation",
      version: "1.0.0",
    },
  },
  apis: ["./routes/**/*.ts", "./controllers/**/*.ts"], // Adjust if needed
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwaggerDocs = (app: Express): void => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log("📘 Swagger docs available at /api-docs");
};
