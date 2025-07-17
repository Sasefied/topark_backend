export interface Event {
  type: string;
  data: any;
}

class EventHandler {
  static async handleEvent(event: Event) {}
}

export default EventHandler;
