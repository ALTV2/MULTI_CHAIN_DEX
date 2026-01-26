'use client';

import { MyOrders } from '@/components/orders/MyOrders';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function OrdersPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            My Orders
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage all your orders
          </p>
        </div>
        <Link href="/trade">
          <Button>Create New Order</Button>
        </Link>
      </div>

      <MyOrders />
    </div>
  );
}
