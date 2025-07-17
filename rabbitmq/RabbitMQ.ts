import amqp, { AmqpConnectionManager } from "amqp-connection-manager";

class RabbitMQ {
  static #connection: AmqpConnectionManager | null;

  /**
   * Establishes a connection to RabbitMQ.
   *
   * @returns {AmqpConnectionManager} - The connection manager.
   */
  static connect(): AmqpConnectionManager | undefined {
    try {
      if (this.#connection) return this.#connection;

      this.#connection = amqp.connect(process.env.RABBITMQ_URL!);

      this.#connection.on("connect", () => {
        console.log("Connected to RabbitMQ");
      });

      this.#connection.on("error", (err) => {
        console.error("RabbitMQ connection error:", err);
      });

      return this.#connection;
    } catch (error) {
      console.error("Error connecting to RabbitMQ:", error);
    }
  }

  /**
   * Closes the existing RabbitMQ connection.
   *
   * @returns {Promise<void>}
   */
  static async close(): Promise<void> {
    try {
      if (this.#connection) {
        await this.#connection.close();
        this.#connection = null;
      }
    } catch (error) {
      console.error("Error closing RabbitMQ connection:", error);
    }
  }
}

export default RabbitMQ;