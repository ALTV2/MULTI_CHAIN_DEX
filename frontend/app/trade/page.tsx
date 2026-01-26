'use client';

import { CreateOrderForm } from '@/components/trade/CreateOrderForm';
import { OrderBook } from '@/components/orderbook/OrderBook';

export default function TradePage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Trade
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create new orders or execute existing ones from the order book
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Create Order Form - Left Side */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6">
            <CreateOrderForm />
          </div>
        </div>

        {/* Order Book - Right Side */}
        <div className="lg:col-span-3">
          <OrderBook />
        </div>
      </div>
    </div>
  );
}
