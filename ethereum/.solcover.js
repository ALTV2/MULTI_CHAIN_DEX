// solidity-coverage disables the Solidity optimizer while instrumenting, which
// makes the larger contracts (CrossChainOrderBook, Trade) hit "stack too deep".
// Enabling the Yul optimizer during coverage resolves it without affecting the
// instrumentation counts.
module.exports = {
  configureYulOptimizer: true,
};
