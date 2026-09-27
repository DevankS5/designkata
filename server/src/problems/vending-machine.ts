import type { Problem } from '../domain/problem.ts';

export const vendingMachine: Problem = {
  slug: 'vending-machine',
  title: 'Vending Machine',
  difficulty: 'Medium',
  timeboxMinutes: 45,
  summary: 'Snacks by slot code, coins and notes in, correct change out, and behaviour that depends on state.',
  context:
    'A college canteen wants a vending machine for snacks and drinks. Students pick a product by its code, pay with coins or notes, and get the product and their change. Between classes there is a queue, so wrong change or a stuck payment is a real problem.',
  requirements: [
    'Products sit in slots identified by a code (A1, B2 and so on), each with a price and a quantity.',
    'A user selects a product, inserts coins or notes, and receives the product and the correct change.',
    'The user can cancel before the product is dispensed and get a full refund.',
    'A selection that is out of stock is refused with a clear message.',
    'An operator can restock products and collect the cash.',
    'What the machine does with a button press depends on its state: idle, has money, dispensing or out of service.',
  ],
  outOfScope: ['Hardware drivers for coin and note readers', 'Remote monitoring dashboards', 'Loyalty points'],
  concepts: [
    { name: 'VendingMachine', synonyms: ['vendingmachine', 'machine'] },
    { name: 'Product', synonyms: ['product', 'item', 'snack'] },
    { name: 'Inventory', synonyms: ['inventory', 'slot', 'shelf', 'rack', 'stock'] },
    { name: 'Payment', synonyms: ['payment', 'coin', 'note', 'money', 'cash', 'denomination'] },
  ],
  variationPoints: [
    {
      id: 'machine-state',
      name: 'Machine state',
      why: 'The same button means different things when idle, holding money, dispensing or out of service.',
      synonyms: ['state', 'mode', 'status'],
      suggestion:
        'A State interface (IdleState, HasMoneyState, DispensingState) takes the if/else on state out of the machine, so a new state is a new class.',
    },
    {
      id: 'payment-method',
      name: 'Payment method',
      why: 'Coins and notes today, UPI and cards next.',
      synonyms: ['paymentmethod', 'paymentprocessor', 'payment', 'wallet'],
      suggestion: 'A PaymentMethod interface lets UPI join coins and notes without editing the machine.',
    },
  ],
  edgeCases: [
    {
      id: 'out-of-stock',
      description: 'The selected product is out of stock.',
      keywords: ['out of stock', 'sold out', 'no stock', 'empty', 'unavailable', 'quantity 0'],
    },
    {
      id: 'no-change',
      description: 'The machine cannot make the change it owes.',
      keywords: ['no change', 'exact change', 'insufficient change', 'cannot return', 'change'],
    },
    {
      id: 'cancel',
      description: 'The user cancels after inserting money.',
      keywords: ['cancel', 'refund', 'abort'],
    },
    {
      id: 'insufficient-money',
      description: 'The money inserted is less than the price.',
      keywords: ['insufficient', 'not enough', 'less than', 'short'],
    },
  ],
  acceptedVariants: [
    'State can be the State pattern or an enum with a transition table. Both are fine if illegal actions in a state are rejected in one place.',
    'Coins and notes can be one Denomination enum or separate classes.',
    'Inventory can be a map from slot code to product and count, or Slot objects that each hold a product.',
  ],
  twist: {
    id: 'upi-async',
    title: 'UPI that confirms later',
    prompt:
      'Add UPI payments. The machine shows a QR code and the bank confirms the payment 5 to 30 seconds later, or never. The product must be dispensed only after confirmation, and a payment confirmed after the user walked away must be refunded. Update your design and explain what changed.',
  },
  starterDiagram: `classDiagram
  %% Replace this with your design.
  class VendingMachine {
    +select(String code)
    +insert(Money money)
  }
  class Product`,
};
