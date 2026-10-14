export const CAP = 1950n * 10n ** 18n;
function price(name: string, fallback: string): bigint {
  const value = process.env[name] || fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be nonnegative integer paise`);
  return BigInt(value);
}
export function costWei(input: number, output: number): bigint {
  if (![input,output].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Invalid usage');
  const paise = (BigInt(input)*price('PRICE_IN_PAISE_PER_1K','5') + BigInt(output)*price('PRICE_OUT_PAISE_PER_1K','15') + 999n)/1000n;
  return paise * 10n**16n;
}
