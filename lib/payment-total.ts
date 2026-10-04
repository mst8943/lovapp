export function matchesPaymentTotal(actual: number | undefined, expected: number) {
  return Number.isInteger(actual) && actual === expected;
}
