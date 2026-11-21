/** Delivery fee for a cart subtotal (shared by the checkout page and the order Server Action). */
export function deliveryFor(subtotalMillimes: number, settings: { deliveryFeeMillimes: number; freeDeliveryFromMillimes: number }) {
  if (settings.freeDeliveryFromMillimes > 0 && subtotalMillimes >= settings.freeDeliveryFromMillimes) return 0;
  return settings.deliveryFeeMillimes;
}
