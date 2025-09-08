// const OrderStatusEnum = {
//   ORDER_INITIATED: "Order Initiated",
//   ORDER_SHIPPED: "Order Shipped",
// };

// const AvailableOrderStatuses  = Object.values(OrderStatusEnum);

// const OrderItemStatusEnum = {
//   ORDER_INITIATED: "Order Initiated",
//   ORDER_PRINTED: "Order Printed",
//   PALLETTE_READY: "Pallette Ready",
// };

// const AvailableOrderItemStatuses = Object.values(OrderItemStatusEnum);

// export {
//   OrderStatusEnum,
//   AvailableOrderStatuses,
//   OrderItemStatusEnum,
//   AvailableOrderItemStatuses,
// };

const OrderStatusEnum = {
  ORDER_INITIATED: "Order Initiated",
  ORDER_SHIPPED: "Order Shipped",
};

const AvailableOrderStatuses = Object.values(OrderStatusEnum);

const OrderItemStatusEnum = {
  ORDER_INITIATED: "Order Initiated",
  ORDER_PRINTED: "Order Printed",
  PALLETTE_READY: "Pallette Ready",
   ORDER_SHIPPED: "Order Shipped",
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
