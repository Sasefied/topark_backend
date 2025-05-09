// utils/errors.ts

export const STATUS_CODES = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export class BaseError extends Error {
  public type: string;
  public statusCode: number;

  constructor(type: string, statusCode: number, message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.type = type;
    this.statusCode = statusCode;
    Error.captureStackTrace(this);
  }
}

export class BadRequestError extends BaseError {
  constructor(message = "Bad Request") {
    super("BadRequestError", STATUS_CODES.BAD_REQUEST, message);
  }
}

export class UnauthorizedError extends BaseError {
  constructor(message = "Unauthorized") {
    super("UnauthorizedError", STATUS_CODES.UNAUTHORIZED, message);
  }
}

export class NotFoundError extends BaseError {
  constructor(message = "Not Found") {
    super("NotFoundError", STATUS_CODES.NOT_FOUND, message);
  }
}

export class InternalServerError extends BaseError {
  constructor(message = "Internal Server Error") {
    super("InternalServerError", STATUS_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

export class ServiceUnavailableError extends BaseError {
  constructor(message = "Service Unavailable") {
    super("ServiceUnavailableError", STATUS_CODES.SERVICE_UNAVAILABLE, message);
  }
}
