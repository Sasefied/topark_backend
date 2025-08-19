const OrderStatusEnum = {
  ORDER_PRINTED: "Order Printed",
  ORDER_SHIPPED: "Order Shipped",
};

const AvailableOrderStatuses = Object.values(OrderStatusEnum);

const OrderItemStatusEnum = {
  ORDER_PRINTED: "Order Printed",
  PALLETTE_READY: "Pallette Ready",
};

const AvailableOrderItemStatuses = Object.values(OrderItemStatusEnum);

export {
  OrderStatusEnum,
  AvailableOrderStatuses,
  OrderItemStatusEnum,
  AvailableOrderItemStatuses,
};
