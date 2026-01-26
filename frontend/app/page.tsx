'use client';

import { useAccount } from 'wagmi';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useOrderBook } from '@/hooks/useOrderBook';
import { useUserOrders } from '@/hooks/useUserOrders';

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const { orders: allOrders } = useOrderBook();
  const { orders: userOrders } = useUserOrders();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
          Multi-Chain DEX
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Trade tokens seamlessly with our decentralized order book exchange.
          Create orders, execute trades, and manage your portfolio all in one place.
        </p>
      </div>

      {!isConnected ? (
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center space-y-6 py-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Get Started
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Connect your wallet to start trading
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Click the Connect Wallet button in the header to begin
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {allOrders.length}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Orders available to execute
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {userOrders.length}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Orders you have created
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm font-mono text-gray-900 dark:text-white break-all">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your wallet address
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 pt-4">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Start Trading</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Create new orders or execute existing ones on our decentralized
              order book.
            </p>
            <Link href="/trade">
              <Button size="lg" className="w-full">
                Go to Trade
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Manage Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              View and manage all your active, completed, and cancelled orders.
            </p>
            <Link href="/orders">
              <Button variant="secondary" size="lg" className="w-full">
                View Your Orders
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-accent-blue/10 flex items-center justify-center text-accent-blue font-bold text-xl">
                1
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Create Order
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Specify the tokens you want to trade and the amounts. Your tokens
                will be locked in the contract.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-accent-green/10 flex items-center justify-center text-accent-green font-bold text-xl">
                2
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Wait for Match
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Other users can browse the order book and execute your order if
                they find it favorable.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-accent-orange/10 flex items-center justify-center text-accent-orange font-bold text-xl">
                3
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Complete Trade
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Once executed, the tokens are automatically swapped between you
                and the executor.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
