const jwt = require("jsonwebtoken");
const { JWT_SECRET_KEY } = require("../config");

class Token {
  generateToken(payload, expiryTime) {
    return jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: expiryTime });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET_KEY);
    } catch (err) {
      return null;
    }
  }
}

module.exports = Token;
