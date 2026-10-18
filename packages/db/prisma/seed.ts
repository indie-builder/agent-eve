import { prisma } from "../src/postgres/client.js";
import { ecommerceFixture } from "./fixtures/ecommerce.js";
import { seedEvents } from "./fixtures/template-events.js";

try {
  for (const event of seedEvents) {
    await prisma.templateEvent.upsert({
      where: { id: event.id },
      create: event,
      update: {
        type: event.type,
        payload: event.payload,
        createdAt: event.createdAt,
      },
    });
  }

  for (const customer of ecommerceFixture.customers) {
    await prisma.ecommerceCustomer.upsert({
      where: { id: customer.id },
      create: customer,
      update: customer,
    });
  }

  for (const product of ecommerceFixture.products) {
    await prisma.ecommerceProduct.upsert({
      where: { id: product.id },
      create: product,
      update: product,
    });
  }

  for (const order of ecommerceFixture.orders) {
    await prisma.ecommerceOrder.upsert({
      where: { id: order.id },
      create: order,
      update: order,
    });
  }

  for (const item of ecommerceFixture.orderItems) {
    await prisma.ecommerceOrderItem.upsert({
      where: { id: item.id },
      create: item,
      update: item,
    });
  }

  for (const payment of ecommerceFixture.payments) {
    await prisma.ecommercePayment.upsert({
      where: { id: payment.id },
      create: payment,
      update: payment,
    });
  }

  console.log(
    `Seeded ${seedEvents.length} template events, ${ecommerceFixture.customers.length} ecommerce customers, ${ecommerceFixture.products.length} products, ${ecommerceFixture.orders.length} orders, ${ecommerceFixture.orderItems.length} order items, and ${ecommerceFixture.payments.length} payments.`,
  );
} finally {
  await prisma.$disconnect();
}
