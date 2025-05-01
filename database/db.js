const { Pool } = require("pg");
const { DATABASE_URL, DATABASE_NAME } = require("../config");
const path = require("path");
const fs = require("fs");

class DB {
  static #pool;
  static #isConnected = false;

  static async connect() {
    // if (!this.#pool) {
    //   this.#pool = new Pool({
    //     user: PGUSER,
    //     password: PGPASSWORD,
    //     host: PGHOST,
    //     port: PGPORT,
    //     database: PGDATABASE,
    //     ssl: {
    //       rejectUnauthorized: false,
    //     },
    //   });

    if (!this.#pool) {
      this.#pool = new Pool({
        connectionString: `${DATABASE_URL}/${DATABASE_NAME}`,
        // ssl: NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
        ssl: false,
      });

      this.#pool.on("error", (err) => {
        console.error("Unexpected error on idle client", err);
        process.exit(-1);
      });

      this.#pool.on("connect", (con) => {
        if (!this.#isConnected) console.log("Connected to database");
        this.#isConnected = true;
      });

      await this.createTable();
    }
    return this.#pool.connect();
  }

  static async query(query) {
    return this.#pool.query(query);
  }

  static async createTable() {
    const pathToSQL = path.join(__dirname, "queries", "create.sql");
    const rawQuery = fs.readFileSync(pathToSQL).toString();

    const queries = rawQuery.split(";");

    const processedQueries = queries
      .filter((query) => query.trim() !== "")
      .map((query) => query.replace(/\n/g, "").replace(/\s+/g, " "));

    const query = rawQuery.replace(/\n/g, "").replace(/\s+/g, " ");
    return this.#pool.query(query);
  }

  static async dropTable() {
    const pathToSQL = path.join(__dirname, "queries", "drop.sql");
    const rawQuery = fs.readFileSync(pathToSQL).toString();
    const query = rawQuery.replace(/\n/g, "").replace(/\s+/g, " ");
    return this.#pool.query(query);
  }
}

module.exports = DB;
