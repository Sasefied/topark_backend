import { Channel, ChannelWrapper } from "amqp-connection-manager"
import RabbitMQ from "./RabbitMQ"
import { randomUUID } from "crypto"

interface Message {
  content: Buffer
  properties: {
    replyTo: string
    correlationId: string
  }
  fields: {
    consumerTag: string
  }
}

export interface RPCMessage {
  type: string;
  data: any;
}

interface Responder {
  respondRPC: (message: any) => Promise<void>
}

class RPC {
  /**
   * Sends a request to the specified service's RPC endpoint
   * @param {string} serviceRPC - The service to send the request to
   * @param {object} requestPayload - The request payload to be sent
   * @param {number} timeoutMS - Optional timeout in milliseconds, defaults to 10s
   * @returns {Promise<object>} - A promise that resolves with the response from the service
   */
  static async request(
    serviceRPC: string,
    requestPayload: { type: string; data: any },
    timeoutMS: number = 10000
  ) {
    try {
      const id = randomUUID()

      const connection = RabbitMQ.connect()
      if (!connection) {
        throw new Error("RabbitMQ connection not established")
      }

      const channel: Channel = connection.createChannel({
        name: `${serviceRPC}-rpc-requester`,
        setup: (channel: Channel) => {
          return Promise.resolve(channel)
        },
        confirm: false,
      })

      await channel.waitForConnect()
      const queue = await channel.assertQueue("", {
        exclusive: true,
      })

      channel.sendToQueue(
        queue.queue,
        Buffer.from(JSON.stringify(requestPayload)),
        { replyTo: queue.queue, correlationId: id }
      )

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(async () => {
          try {
            await channel.deleteQueue(queue.queue)
            await channel.close()
            reject("Request timed out")
          } catch (error) {
            console.log(`Failed to delete queue ${queue.queue}: ${error}`)
            reject("Request timed out")
          }
        }, timeoutMS)

        const consumerTag = channel.consume(
          queue.queue,
          async (data: Message) => {
            if (data.properties.correlationId === id) {
              clearTimeout(timeout)
              resolve(JSON.parse(data.content.toString()))
              await channel.cancel(data.fields.consumerTag)
              await channel.deleteQueue(queue.queue)
              await channel.close()
            }
          },
          { noAck: true }
        )

        consumerTag.catch((err: Error) => {
          clearTimeout(timeout)
          console.log(`Failed to consume queue: ${err}`)
          reject("Consumer setup failed")
        })
      })
    } catch (error) {
      console.error("Error sending RPC request:", error)
      throw error
    }
  }

  static async respond(responder: Responder) {
    const RPC_QUEUE = process.env.BACKEND_RPC
    try {
      const connection = RabbitMQ.connect()
      if (!connection) {
        throw new Error("RabbitMQ connection not established")
      }

      const onMessage = async (data: Message) => {
        if (data.content) {
          const message: RPCMessage = JSON.parse(data.content.toString())
          const response = await responder.respondRPC(message)
          channel.sendToQueue(
            data.properties.replyTo,
            Buffer.from(JSON.stringify(response)),
            { correlationId: data.properties.correlationId }
          )
          channel.ack(data)
        }
      }

      const channel: Channel = connection.createChannel({
        name: `${RPC_QUEUE}-rpc-responder`,
        setup: (channel: Channel) => {
          return Promise.all([
            channel.assertQueue(RPC_QUEUE, {
              durable: true,
              autoDelete: true,
            }),
            channel.prefetch(1),
            channel.consume(RPC_QUEUE, onMessage, {
              noAck: false,
            }),
          ])
        },
      })

      channel
        .waitForConnect()
        .then(() => console.log("Responding to RPC requests:", RPC_QUEUE))
        .catch((err: Error) =>
          console.error("Failed to connect to RabbitMQ:", err)
        )
    } catch (error) {
      console.error("Error setting up RPC responder:", error)
    }
  }
}

export default RPC
