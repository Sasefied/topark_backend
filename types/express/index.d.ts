import * as express from "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        [x: string]: any;
        id: string;
        orgId: string;
        email: string;
      };
    }
  }
}

export {};
