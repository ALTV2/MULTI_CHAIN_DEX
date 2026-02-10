export type Locale = 'en' | 'ru';

export interface Translations {
  // Navigation
  'nav.dashboard': string;
  'nav.orders': string;
  'nav.mySwaps': string;
  'nav.profile': string;

  // Dashboard
  'dashboard.badge': string;
  'dashboard.title': string;
  'dashboard.subtitle': string;
  'dashboard.stats.activeOrders': string;
  'dashboard.stats.activeSwaps': string;
  'dashboard.stats.chains': string;
  'dashboard.cta.createOrder': string;
  'dashboard.cta.createOrderDesc': string;
  'dashboard.cta.mySwaps': string;
  'dashboard.cta.mySwapsDesc': string;
  'dashboard.liveFeed.title': string;
  'dashboard.liveFeed.empty': string;
  'dashboard.howItWorks.title': string;
  'dashboard.howItWorks.step1.title': string;
  'dashboard.howItWorks.step1.desc': string;
  'dashboard.howItWorks.step2.title': string;
  'dashboard.howItWorks.step2.desc': string;
  'dashboard.howItWorks.step3.title': string;
  'dashboard.howItWorks.step3.desc': string;
  'dashboard.howItWorks.step4.title': string;
  'dashboard.howItWorks.step4.desc': string;

  // About
  'about.title': string;
  'about.desc': string;
  'about.feature1.title': string;
  'about.feature1.desc': string;
  'about.feature2.title': string;
  'about.feature2.desc': string;
  'about.feature3.title': string;
  'about.feature3.desc': string;
  'about.feature4.title': string;
  'about.feature4.desc': string;

  // Orders
  'orders.title': string;
  'orders.subtitle': string;
  'orders.browseOrders': string;
  'orders.createOrder': string;
  'orders.sameChain': string;
  'orders.crossChain': string;
  'orders.table.price': string;
  'orders.table.sell': string;
  'orders.table.buy': string;
  'orders.table.creator': string;
  'orders.table.expires': string;
  'orders.table.action': string;
  'orders.table.you': string;
  'orders.table.expired': string;
  'orders.table.match': string;
  'orders.table.execute': string;
  'orders.table.empty': string;
  'orders.table.emptyDesc': string;
  'orders.table.loading': string;

  // Chain pair selector
  'chainPair.fromChain': string;
  'chainPair.toChain': string;
  'chainPair.token': string;
  'chainPair.swap': string;
  'chainPair.customToken': string;

  // Swap
  'swap.title': string;
  'swap.subtitle': string;
  'swap.createSwap': string;
  'swap.availableOrders': string;
  'swap.mySwaps': string;
  'swap.connectWallet': string;
  'swap.connectWalletDesc': string;
  'swap.howItWorks.title': string;
  'swap.howItWorks.step1.title': string;
  'swap.howItWorks.step1.desc': string;
  'swap.howItWorks.step2.title': string;
  'swap.howItWorks.step2.desc': string;
  'swap.howItWorks.step3.title': string;
  'swap.howItWorks.step3.desc': string;

  // Swap Form
  'swapForm.title': string;
  'swapForm.sellOn': string;
  'swapForm.buyOn': string;
  'swapForm.balance': string;
  'swapForm.receiveOn': string;
  'swapForm.receiveOnDesc': string;
  'swapForm.orderExpiry': string;
  'swapForm.expiryDesc': string;
  'swapForm.creating': string;
  'swapForm.create': string;
  'swapForm.success': string;

  // Match Modal
  'match.title': string;
  'match.youReceive': string;
  'match.youSend': string;
  'match.confirm': string;
  'match.switchTo': string;
  'match.confirming': string;
  'match.confirmWallet': string;
  'match.executeOrder': string;
  'match.executing': string;

  // Profile
  'profile.title': string;
  'profile.connectWallet': string;
  'profile.connectWalletDesc': string;
  'profile.tabs.overview': string;
  'profile.tabs.wallets': string;
  'profile.tabs.history': string;
  'profile.tabs.settings': string;
  'profile.balance': string;
  'profile.activeSwaps': string;
  'profile.completed': string;
  'profile.chainBalances': string;
  'profile.connected': string;
  'profile.settings.secretStorage': string;
  'profile.settings.secretStorageDesc': string;
  'profile.settings.localStorage': string;
  'profile.settings.localStorageDesc': string;
  'profile.settings.database': string;
  'profile.settings.databaseDesc': string;
  'profile.settings.showOnce': string;
  'profile.settings.showOnceDesc': string;
  'profile.settings.targetWallets': string;
  'profile.settings.targetWalletsDesc': string;
  'profile.settings.noWallets': string;
  'profile.settings.disconnect': string;
  'profile.settings.disconnectDesc': string;
  'profile.signedIn': string;

  // Common
  'common.loading': string;
  'common.error': string;
  'common.retry': string;
  'common.cancel': string;
  'common.close': string;
  'common.save': string;
  'common.search': string;
  'common.noResults': string;
  'common.timeAgo': string;
  'common.hoursAgo': string;
  'common.minutesAgo': string;
  'common.justNow': string;
}
