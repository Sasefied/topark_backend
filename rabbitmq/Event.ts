import RabbitMQ from "./RabbitMQ";
import { ChannelWrapper, Channel } from "amqp-connection-manager";

const { SERVICE_QUEUE, EXCHANGE_NAME } = process.env;

class Event {
  static publishChannelWrapper: ChannelWrapper | null = null;

  static async #getPublishChannelWrapper() {
    if (!this.publishChannelWrapper) {
      const connection = RabbitMQ.connect();
      if (!connection) {
        throw new Error("RabbitMQ connection not established");
      }
      this.publishChannelWrapper = await connection.createChannel({
        name: `${SERVICE_QUEUE}-event-publisher`,
        json: true,
        setup(channel: Channel) {
          return channel.assertExchange(EXCHANGE_NAME!, "direct", {
            durable: true,
          });
        },
      });
    }
    return this.publishChannelWrapper;
  }

  /**
   * Publishes an event on the message broker to the specified service's queue
   * @param {string} service - The service to publish the event to
   * @param {object} data - The event data to be published
   * @returns {Promise<void>}
   */
  static async publish(service: string, data: object): Promise<void> {
    try {
      const channel = await this.#getPublishChannelWrapper();
      channel.publish(EXCHANGE_NAME!, service, data);
      console.log("Event published:", data);
    } catch (error) {
      console.error("Error publishing event:", error);
    }
  }

  /**
   * Creates a subscriber for events published to the specified service's queue
   * @param {string} service - The service to subscribe to
   * @param {object} subscriber - The subscriber object with a handleEvent method
   * @returns {Promise<ChannelWrapper>} - The channel wrapper for the subscriber
   */
  static async subscriber(
    service: string,
    subscriber: { handleEvent: (message: any) => Promise<void> }
  ) {
    const connection = RabbitMQ.connect();

    /**
     * Sets up a channel for consuming events from the specified service's queue
     * @param {Channel} channel - The channel to set up
     * @returns {Promise<void>}
     */
    const setupChannel = async (
      channel: ChannelWrapper | Channel
    ): Promise<void> => {
      await channel.assertExchange(EXCHANGE_NAME!, "direct", { durable: true });
      await channel.assertQueue(SERVICE_QUEUE!, {
        durable: true,
        arguments: { "x-q-type": "quorum" },
      });
      await channel.bindQueue(SERVICE_QUEUE!, EXCHANGE_NAME!, service);
      await channel.consume(
        SERVICE_QUEUE!,
        async (data: { content: Buffer } & any) => {
          if (data.content) {
            try {
              const message: Record<string, any> = JSON.parse(
                data.content.toString()
              );
              await subscriber.handleEvent(message);
              channel.ack(data);
            } catch (error) {
              console.error("Error handling event:", error);
              channel.nack(data);
            }
          }
        },
        {
          noAck: false,
        }
      );
    };

    if (!connection) {
      throw new Error("RabbitMQ connection not established");
    }

    const channelWrapper = connection.createChannel({
      name: `${SERVICE_QUEUE}-event-subscriber`,
      json: true,
      setup: setupChannel,
    });

    channelWrapper.addSetup((channel: Channel) => {
      return channel.prefetch(1);
    });

    connection.on("connect", async () => {
      console.log("Binding queues...");
      await setupChannel(channelWrapper);
    });

    channelWrapper
      .waitForConnect()
      .then(() => console.log(`Listening for events from service ${service}`))
      .catch((error) => console.log("Failed to subscribe to service", error));
  }
}

export default Event;