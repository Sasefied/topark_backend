import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import config from "./config";

// Ensure your route files have JSDoc @swagger annotations in comments
// so swagger-jsdoc can pick up the operations for each endpoint.

const isProd = process.env.NODE_ENV === "production";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Toprak API Documentation",
    version: "1.0.0",
    description: "Interactive API documentation for Toprak backend routes",
  },
  servers: [
    {
      url: isProd
        ? "https://topark-backend.onrender.com/api"
        : `http://localhost:${config.PORT}/api`,
      description: isProd ? "Production server" : "Development server",
    },
  ],
  /*
  // Uncomment the following sections to enable global authorization
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
  */
};

const options = {
  definition: swaggerDefinition,
  apis: [
    "./api/**/*.ts", // Adjusted to match your project structure
    "./controllers/**/*.ts",
  ],
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwaggerDocs = (app: Express): void => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log("📘 Swagger docs available at /api-docs");
};
