/**
 * Finite decimal value = coefficient * 10^exponent. BigInt is authoritative;
 * Number is used only for explicitly lossy UI conversion / bounded ratios.
 *
 * Original 32-byte native value contains a cached coefficient string, int32
 * decimal exponent (+8), and System.Numerics.BigInteger (+16). See evidence
 * numeric-20260930. significant()/nativeMultiply()/nativeAdd()/nativeDivide()
 * reproduce the traced truncation operations. add/sub/mul are exact decimal
 * operations for authoritative balances; they do not silently cap precision.
 */
export interface BigValueJSON { coefficient: string; exponent: number }
export type BigValueInput = BigValue | BigValueJSON | bigint | number | string;
export interface BigValueFormatOptions {
  significantDigits?: number;
  notation?: 'auto' | 'scientific' | 'plain';
  /** Optional game/config suffixes: index zero denotes 10^3. */
  suffixes?: readonly string[];
}
const MAX_EXPONENT = 1_000_000;
function checkedExponent(exponent: number): number {
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > MAX_EXPONENT)
    throw new RangeError('BigValue exponent must be an integer within ±1000000');
  return exponent;
}
function pow10(exponent: number): bigint {
  if (!Number.isSafeInteger(exponent) || exponent < 0 || exponent > MAX_EXPONENT)
    throw new RangeError('Invalid decimal scale');
  return 10n ** BigInt(exponent);
}
function absolute(value: bigint): bigint { return value < 0n ? -value : value; }
function checkedPrecision(digits: number): number {
  if (!Number.isSafeInteger(digits) || digits < 1 || digits > MAX_EXPONENT)
    throw new RangeError('Precision must be a positive integer');
  return digits;
}

export class BigValue {
  readonly coefficient: bigint;
  readonly exponent: number;
  constructor(coefficient: bigint, exponent = 0) {
    this.coefficient = coefficient;
    this.exponent = checkedExponent(exponent);
    Object.freeze(this);
  }
  static readonly ZERO = new BigValue(0n);
  static readonly ONE = new BigValue(1n);
  static from(value: BigValueInput): BigValue {
    if (value instanceof BigValue) return value;
    if (typeof value === 'bigint') return new BigValue(value);
    if (typeof value === 'number') return BigValue.fromNumber(value);
    if (typeof value === 'string') return BigValue.parse(value);
    return BigValue.fromJSON(value);
  }
  /** Traced native double construction uses invariant G17, then H17. */
  static fromNumber(value: number): BigValue {
    if (!Number.isFinite(value)) throw new RangeError('BigValue cannot contain NaN or Infinity');
    return BigValue.parse(value.toPrecision(17)).significant(17);
  }
  /** Native int32 construction at 0x45544b8 explicitly requests five digits. */
  static fromInteger(value: number | bigint, precision = 5): BigValue {
    if (typeof value === 'number' && !Number.isSafeInteger(value))
      throw new RangeError('Integer input must be safe');
    return new BigValue(BigInt(value)).significant(precision);
  }
  static parse(value: string): BigValue {
    const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(value.trim());
    if (!match) throw new TypeError('Invalid finite decimal value');
    const fraction = match[3] ?? '';
    const exponent = Number(match[4] ?? 0) - fraction.length;
    const coefficient = BigInt(`${match[1] === '-' ? '-' : ''}${match[2]}${fraction}`);
    return new BigValue(coefficient, exponent);
  }
  static fromJSON(value: unknown): BigValue {
    if (!value || typeof value !== 'object') throw new TypeError('Invalid BigValue JSON');
    const data = value as Record<string, unknown>;
    if (typeof data.coefficient !== 'string' || !/^-?\d+$/.test(data.coefficient)
      || typeof data.exponent !== 'number') throw new TypeError('Invalid BigValue JSON');
    return new BigValue(BigInt(data.coefficient), data.exponent);
  }
  toJSON(): BigValueJSON {
    return { coefficient: this.coefficient.toString(), exponent: this.exponent };
  }
  get sign(): -1 | 0 | 1 { return this.coefficient < 0n ? -1 : this.coefficient > 0n ? 1 : 0; }
  get isZero(): boolean { return this.coefficient === 0n; }
  /** Native zero precision special case at 0x4554ee0. */
  get precision(): number {
    return this.isZero && this.exponent < 1 ? 1 - this.exponent : absolute(this.coefficient).toString().length;
  }
  get order(): number {
    return this.isZero ? -Infinity : absolute(this.coefficient).toString().length - 1 + this.exponent;
  }
  abs(): BigValue { return this.sign < 0 ? this.negate() : this; }
  negate(): BigValue { return new BigValue(-this.coefficient, this.exponent); }
  normalized(): BigValue {
    if (this.isZero) return BigValue.ZERO;
    let coefficient = this.coefficient, exponent = this.exponent;
    while (coefficient % 10n === 0n) { coefficient /= 10n; exponent++; }
    return new BigValue(coefficient, exponent);
  }
  /** 0x4554f68 -> 0x45589dc: rescale via multiply or truncating integer division. */
  rescaleExponent(exponent: number): BigValue {
    checkedExponent(exponent);
    const delta = exponent - this.exponent;
    if (delta === 0) return this;
    if (delta >= this.precision) return new BigValue(0n, exponent);
    return new BigValue(delta > 0 ? this.coefficient / pow10(delta) : this.coefficient * pow10(-delta), exponent);
  }
  /** H_n (0x4558464). Truncates toward zero; never rounds to nearest. */
  significant(digits: number): BigValue {
    checkedPrecision(digits);
    if (this.precision === digits) return this;
    return this.rescaleExponent(this.exponent + this.precision - digits);
  }
  /** G (0x455a16c), integer truncation used BEFORE price display H3. */
  truncateInteger(): BigValue { return this.exponent >= 0 ? this : this.rescaleExponent(0); }
  add(input: BigValueInput): BigValue {
    const other = BigValue.from(input);
    if (this.isZero) return other;
    if (other.isZero) return this;
    const exponent = Math.min(this.exponent, other.exponent);
    return new BigValue(this.coefficient * pow10(this.exponent - exponent)
      + other.coefficient * pow10(other.exponent - exponent), exponent);
  }
  sub(input: BigValueInput): BigValue { return this.add(BigValue.from(input).negate()); }
  subtract(input: BigValueInput): BigValue { return this.sub(input); }
  mul(input: BigValueInput): BigValue {
    const other = BigValue.from(input);
    return new BigValue(this.coefficient * other.coefficient, this.exponent + other.exponent);
  }
  multiply(input: BigValueInput): BigValue { return this.mul(input); }
  /** Arbitrary division uses requested significant precision, truncated toward zero. */
  div(input: BigValueInput, digits = 17): BigValue {
    checkedPrecision(digits);
    const other = BigValue.from(input);
    if (other.isZero) throw new RangeError('Division by zero');
    if (this.isZero) return BigValue.ZERO;
    const scale = digits + other.precision + 1;
    const numerator = this.coefficient * pow10(scale);
    return new BigValue(numerator / other.coefficient, this.exponent - other.exponent - scale).significant(digits);
  }
  nativeMultiply(input: BigValueInput): BigValue {
    const other = BigValue.from(input);
    return this.normalized().mul(other.normalized()).significant(Math.max(this.precision, other.precision));
  }
  /** Native addition 0x4558020 / subtraction 0x4558270 preserve MAX input
   * precision. Each nonzero operand is truncated to a shared exponent BEFORE
   * arithmetic; exact decimal arithmetic followed by Hmax is not equivalent.
   */
  private nativeAddOrSubtract(input: BigValueInput, subtract: boolean): BigValue {
    const other = BigValue.from(input), digits = Math.max(this.precision, other.precision);
    if (this.isZero) return (subtract ? other.negate() : other).significant(digits);
    if (other.isZero) return this.significant(digits);
    const exponent = Math.max(this.exponent + this.precision - digits,
      other.exponent + other.precision - digits);
    const left = this.rescaleExponent(exponent), right = other.rescaleExponent(exponent);
    return new BigValue(subtract ? left.coefficient - right.coefficient : left.coefficient + right.coefficient,
      exponent).significant(digits);
  }
  nativeAdd(input: BigValueInput): BigValue { return this.nativeAddOrSubtract(input, false); }
  nativeSubtract(input: BigValueInput): BigValue { return this.nativeAddOrSubtract(input, true); }
  nativeDivide(input: BigValueInput): BigValue {
    const other = BigValue.from(input);
    // 0x45587e8 uses the larger input precision as decimal division shift.
    const digits = Math.max(this.precision, other.precision);
    if (other.isZero) throw new RangeError('Division by zero');
    return new BigValue(this.coefficient * pow10(digits) / other.coefficient,
      this.exponent - other.exponent - digits).significant(digits);
  }
  compare(input: BigValueInput): -1 | 0 | 1 {
    const other = BigValue.from(input);
    if (this.sign !== other.sign) return this.sign < other.sign ? -1 : 1;
    if (this.isZero) return 0;
    if (this.order !== other.order) return (this.order < other.order ? -this.sign : this.sign) as -1 | 1;
    const a = absolute(this.coefficient).toString(), b = absolute(other.coefficient).toString();
    const width = Math.max(a.length, b.length);
    const aa = a.padEnd(width, '0'), bb = b.padEnd(width, '0');
    return aa === bb ? 0 : (aa < bb ? -this.sign : this.sign) as -1 | 1;
  }
  eq(input: BigValueInput): boolean { return this.compare(input) === 0; }
  lt(input: BigValueInput): boolean { return this.compare(input) < 0; }
  lte(input: BigValueInput): boolean { return this.compare(input) <= 0; }
  gt(input: BigValueInput): boolean { return this.compare(input) > 0; }
  gte(input: BigValueInput): boolean { return this.compare(input) >= 0; }
  min(input: BigValueInput): BigValue { const other = BigValue.from(input); return this.lte(other) ? this : other; }
  max(input: BigValueInput): BigValue { const other = BigValue.from(input); return this.gte(other) ? this : other; }
  /** Explicit lossy conversion. May return Infinity beyond binary64 range. */
  toNumber(): number { return Number(`${this.coefficient}e${this.exponent}`); }
  /** Lossy ratio without converting either huge operand to Number. */
  ratio(input: BigValueInput, maximum = Infinity): number {
    const other = BigValue.from(input);
    if (other.isZero) throw new RangeError('Ratio denominator is zero');
    if (this.isZero) return 0;
    const a = absolute(this.coefficient).toString(), b = absolute(other.coefficient).toString();
    const lead = (text: string) => Number(`${text[0]}.${text.slice(1, 17)}`);
    const delta = this.order - other.order;
    const result = Number(`${lead(a) / lead(b)}e${delta}`) * this.sign * other.sign;
    return Math.min(maximum, result);
  }
  /** Safe [0,1] bar fraction, including a zero/zero depleted bar. */
  fractionOf(input: BigValueInput): number {
    const other = BigValue.from(input);
    if (other.isZero) return 0;
    return Math.max(0, this.ratio(other, 1));
  }
  toPlainString(): string {
    const digits = absolute(this.coefficient).toString();
    if (this.isZero) return '0';
    const sign = this.sign < 0 ? '-' : '';
    const point = digits.length + this.exponent;
    if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`;
    if (point >= digits.length) return sign + digits + '0'.repeat(point - digits.length);
    return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
  }
  /** Deterministic UI truncation; configured native suffix inventory remains unverified. */
  format(options: BigValueFormatOptions | number = {}): string {
    const opts = typeof options === 'number' ? { significantDigits: options } : options;
    const digits = checkedPrecision(opts.significantDigits ?? 3);
    if (this.isZero) return '0';
    const value = this.significant(digits).normalized();
    const trim = (text: string) => text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
    const group = Math.floor(value.order / 3);
    if (opts.notation !== 'scientific' && opts.notation !== 'plain' && group > 0 && opts.suffixes?.[group - 1] != null)
      return trim(new BigValue(value.coefficient, value.exponent - group * 3).toPlainString()) + opts.suffixes[group - 1];
    if (opts.notation === 'plain' || (opts.notation !== 'scientific' && value.order >= -3 && value.order < 6))
      return trim(value.toPlainString());
    const mantissa = trim(new BigValue(value.coefficient, value.exponent - value.order).toPlainString());
    return `${mantissa}e${value.order}`;
  }
  toString(): string { return this.format({ significantDigits: this.precision }); }
  /** Prevent accidental numeric coercion that would destroy high-level state. */
  valueOf(): never { throw new TypeError('Use BigValue.compare/ratio/toNumber explicitly'); }
}
export function formatBigValue(value: BigValueInput, options?: BigValueFormatOptions | number): string {
  return BigValue.from(value).format(options);
}
