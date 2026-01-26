export const CONTRACT_ERRORS: Record<string, string> = {
  // OrderBook errors
  InvalidAmounts: 'Amounts must be greater than zero',
  SameAssetTrade: 'Cannot trade the same token',
  TokenNotSupported: 'This token is not supported',
  IncorrectETHAmount: 'Incorrect ETH amount sent',
  ETHSentWithERC20: 'Do not send ETH when trading ERC20 tokens',
  InsufficientAllowance: 'Please approve tokens first',
  TokenTransferFailed: 'Token transfer failed',
  OrderDoesNotExist: 'Order does not exist',
  OrderNotActive: 'Order is no longer active',
  NotOrderCreator: 'Only the order creator can perform this action',
  ETHReturnFailed: 'Failed to return ETH',
  ETHTransferToTradeFailed: 'Failed to transfer ETH to trade contract',

  // Trade errors
  CannotExecuteOwnOrder: 'You cannot execute your own order',
  ETHTransferToCreatorFailed: 'Failed to send ETH to order creator',
  ETHTransferToExecutorFailed: 'Failed to send ETH to you',
  TokenBuyTransferFailed: 'Failed to transfer tokens to order creator',
  TokenSellTransferFailed: 'Failed to transfer tokens to you',

  // General errors
  ReentrancyGuardReentrantCall: 'Transaction failed, please try again',
  OwnableUnauthorizedAccount: 'You are not authorized to perform this action',
};

export function parseContractError(error: unknown): string {
  if (!error) return 'An unknown error occurred';

  const errorMessage =
    error instanceof Error ? error.message : String(error);

  // Try to extract custom error name
  const customErrorMatch = errorMessage.match(
    /reverted with custom error '(\w+)\(\)'/
  );
  if (customErrorMatch) {
    const errorName = customErrorMatch[1];
    return CONTRACT_ERRORS[errorName] || `Transaction failed: ${errorName}`;
  }

  // Try to extract reason string
  const reasonMatch = errorMessage.match(/reason="([^"]+)"/);
  if (reasonMatch) {
    const reason = reasonMatch[1];
    return CONTRACT_ERRORS[reason] || reason;
  }

  // Check for user rejection
  if (
    errorMessage.includes('user rejected') ||
    errorMessage.includes('User denied') ||
    errorMessage.includes('User rejected')
  ) {
    return 'Transaction was rejected';
  }

  // Check for insufficient funds
  if (errorMessage.includes('insufficient funds')) {
    return 'Insufficient balance for this transaction';
  }

  // Check for gas estimation errors
  if (errorMessage.includes('gas required exceeds')) {
    return 'Transaction would fail. Please check your inputs.';
  }

  return 'Transaction failed. Please try again.';
}

export function isUserRejection(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('user rejected') ||
    message.includes('User denied') ||
    message.includes('User rejected')
  );
}
