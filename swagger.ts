import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import config from "./config";

const isProd = process.env.NODE_ENV === "production";

// securitySchemes
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
        ? "https://topark-backend.onrender.com/"
        : `http://localhost:${config.PORT}/`,
      description: isProd ? "Production server" : "Development server",
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
  security: [],
};

const options = {
  definition: swaggerDefinition,
  apis: isProd
    ? ["./dist/controllers/**/*.js", "./dist/routes/**/*.js"] // Production
    : ["./controllers/**/*.ts", "./routes/**/*.ts"], // Development
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwaggerDocs = (app: Express): void => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log("📘 Swagger docs available at /api-docs");
};
