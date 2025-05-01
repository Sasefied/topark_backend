const joi = require('joi');
const { BadRequestError } = require("../utils/errors");

module.exports = function (schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    const valid = error == null;

    if (valid) {
      next();
    } else {
      const { details } = error;
      console.log(details);

      const message = details.map(i => i.message.replace(/['"]/g, ""));

      throw new BadRequestError(message[0]);
    }

  };
};