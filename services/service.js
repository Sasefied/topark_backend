const { Repository } = require("../database")
const { NotFoundError } = require("../utils/errors")

// Service will contain all the business logic
class Service {
  constructor() {
    this.repository = new Repository()
    this.token = new Token()
  }

  // Login method will be used to authenticate the user
  async login(email, password) {
    const user = await this.repository.getUser(email)

    if (!user) throw new NotFoundError("User not found")

    console.log("user", user)
  }
}

module.exports = Service
