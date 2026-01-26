export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  const start = address.slice(0, chars + 2);
  const end = address.slice(-chars);
  return `${start}...${end}`;
}

export function formatNumber(
  value: number | string,
  decimals = 4
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  if (num === 0) return '0';
  if (num < 0.0001) return '< 0.0001';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  
  return num.toFixed(decimals).replace(/\.?0+$/, '');
}

export function formatTokenAmount(
  amount: bigint | string,
  decimals: number,
  displayDecimals = 4
): string {
  try {
    const value = typeof amount === 'string' ? BigInt(amount) : amount;
    const divisor = BigInt(10 ** decimals);
    const whole = value / divisor;
    const remainder = value % divisor;
    
    const wholeStr = whole.toString();
    const remainderStr = remainder.toString().padStart(decimals, '0');
    const combined = `${wholeStr}.${remainderStr}`;
    
    return formatNumber(parseFloat(combined), displayDecimals);
  } catch {
    return '0';
  }
}

export function formatTimeAgo(timestamp: number | bigint): string {
  const now = Date.now();
  const then = typeof timestamp === 'bigint' 
    ? Number(timestamp) * 1000 
    : timestamp * 1000;
  const diff = now - then;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
