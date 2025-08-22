const OrderStatusEnum = {
  ORDER_PRINTED: "Order Printed",
  ORDER_SHIPPED: "Order Shipped",
};

const AvailableOrderStatuses = Object.values(OrderStatusEnum);

const SellOrderItemStatusEnum = {
  ORDER_PRINTED: "Order Printed",
  PALLETTE_READY: "Pallette Ready",
};

const AvailableSellOrderItemStatuses = Object.values(SellOrderItemStatusEnum);

const OrderItemStatusEnum = {
  RECEIVE_OK : "Received Ok",
  HAS_ISSUES : "Has Issues"
}

const AvailableOrderItemStatuses = Object.values(OrderItemStatusEnum);

export {
  OrderStatusEnum,
  AvailableOrderStatuses,
  SellOrderItemStatusEnum,
  AvailableSellOrderItemStatuses,
  OrderItemStatusEnum,
  AvailableOrderItemStatuses
};
