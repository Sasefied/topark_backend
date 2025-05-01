const STATUS_CODES = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

class BaseError extends Error {
  constructor(type, statusCode, message) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.type = type;
    this.statusCode = statusCode;
    Error.captureStackTrace(this);
  }
}

// Bad Request Error
class BadRequestError extends BaseError {
  constructor(message = "Bad Request") {
    super("BadRequestError", STATUS_CODES.BAD_REQUEST, message);
  }
}

// Unauthorized Error
class UnauthorizedError extends BaseError {
  constructor(message = "Unauthorized") {
    super("UnauthorizedError", STATUS_CODES.UNAUTHORIZED, message);
  }
}

// Not Found Error
class NotFoundError extends BaseError {
  constructor(message = "Not Found") {
    super("NotFoundError", STATUS_CODES.NOT_FOUND, message);
  }
}

// Internal Server Error
class InternalServerError extends BaseError {
  constructor(message = "Internal Server Error") {
    super("InternalServerError", STATUS_CODES.INTERNAL_SERVER_ERROR, message);
  }
}

// Service Unavailable Error
class ServiceUnavailableError extends BaseError {
  constructor(message = "Service Unavailable") {
    super("ServiceUnavailableError", STATUS_CODES.SERVICE_UNAVAILABLE, message);
  }
}

module.exports = {
  BaseError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  InternalServerError,
  ServiceUnavailableError,
};
