import { RPCMessage } from "./RPC";

class RPCHandler {
  static async respondRPC(request: RPCMessage) {
    console.log("Received RPC request:", request);
  }
}

export default RPCHandler