const Token = require('../utils/token')
const { UnauthorizedError } = require('../utils/errors')

// Middleware to check if the user is authenticated
module.exports = async (req, res, next) => {
  const token = new Token();

  // console.log(req.body);

  const authToken = req.headers["authorization"]?.split(" ")[1];


  if (!authToken)
    throw new UnauthorizedError("Authentication token is required");

  try {
    const decodedToken = token.verifyToken(authToken);

    if (!decodedToken) {
      throw new Error("Invalid Authentication token");
    }
    req.userId = decodedToken.sub;
    next();
  } catch (error) {
    throw new UnauthorizedError(error.message);
  }
};
