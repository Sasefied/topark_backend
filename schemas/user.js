const joi = require("joi");

class UserSchema {
  loginSchema = joi.object().keys({
    email: joi.string().email().required(),
    password: joi.string().min(5).required(),
  });

  registerSchema = joi.object().keys({
    email: joi.string().email().required(),
    password: joi.string().min(5).required(),
    referral_code: joi.string().optional().allow(null),
    // name: joi.string().min(2).required()
  });

  recruiterLoginSchema = joi.object().keys({
    email: joi.string().email().required(),
    password: joi.string().min(5).required(),
  });

  recruiterRegisterSchema = joi.object().keys({
    email: joi.string().email().required(),
    password: joi.string().min(5).required(),
    firstName: joi.string().required(),
    lastName: joi.string().required(),
    contactNumber: joi.string().required(),
    companyName: joi.string().required(),
    companyLocation: joi.string().required(),
  });
}

module.exports = UserSchema;
