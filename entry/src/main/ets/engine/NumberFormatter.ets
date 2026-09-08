class DecimalParts {
  sign: string = '';
  integerPart: string = '0';
  fractionPart: string = '';

  constructor(sign: string, integerPart: string, fractionPart: string) {
    this.sign = sign;
    this.integerPart = integerPart;
    this.fractionPart = fractionPart;
  }
}

class RoundedDigits {
  digits: string = '';
  carry: boolean = false;

  constructor(digits: string, carry: boolean) {
    this.digits = digits;
    this.carry = carry;
  }
}

export default class NumberFormatter {
  static formatForDisplay(raw: string, maxSignificant: number = 12): string {
    let text = raw.trim();
    if (text.length === 0) {
      return '0';
    }
    if (text === 'NaN' || text === 'Infinity' || text === '-Infinity') {
      return 'NaN';
    }

    let exponentIndex = text.indexOf('e');
    if (exponentIndex < 0) {
      exponentIndex = text.indexOf('E');
    }
    if (exponentIndex >= 0) {
      return NumberFormatter.formatExistingScientific(text, maxSignificant);
    }

    let parts = NumberFormatter.expandToParts(text);
    if (parts === null) {
      return text;
    }

    let integerNoZero = NumberFormatter.trimLeadingZeros(parts.integerPart);
    if (integerNoZero.length > 0) {
      let exponent = integerNoZero.length - 1;
      if (exponent >= 12) {
        return parts.sign + NumberFormatter.toScientific(integerNoZero + parts.fractionPart, exponent, maxSignificant);
      }
      let visible = integerNoZero;
      if (parts.fractionPart.length > 0) {
        visible += '.' + parts.fractionPart;
      }
      // Long high-precision decimals remain normal decimals; the raw string is kept for copy/history.
      if (visible.length > 22 && visible.indexOf('.') >= 0) {
        visible = NumberFormatter.limitPlainDecimal(visible, 18);
      }
      return parts.sign + NumberFormatter.trimDecimalZeros(visible);
    }

    let firstNonZero = NumberFormatter.firstNonZero(parts.fractionPart);
    if (firstNonZero < 0) {
      return '0';
    }
    let exponent = -(firstNonZero + 1);
    if (exponent <= -9) {
      return parts.sign + NumberFormatter.toScientific(parts.fractionPart.substring(firstNonZero), exponent, maxSignificant);
    }

    let plain = '0.' + parts.fractionPart;
    if (plain.length > 22) {
      plain = NumberFormatter.limitPlainDecimal(plain, 18);
    }
    return parts.sign + NumberFormatter.trimDecimalZeros(plain);
  }

  static normalizeForStorage(raw: string): string {
    let text = raw.trim();
    if (text.length === 0) {
      return '0';
    }
    return text;
  }

  private static formatExistingScientific(text: string, maxSignificant: number): string {
    let sign = '';
    let body = text;
    if (body.startsWith('-')) {
      sign = '-';
      body = body.substring(1);
    } else if (body.startsWith('+')) {
      body = body.substring(1);
    }
    let eIndex = body.indexOf('e');
    if (eIndex < 0) {
      eIndex = body.indexOf('E');
    }
    if (eIndex < 0) {
      return text;
    }
    let mantissa = body.substring(0, eIndex);
    let exponentText = body.substring(eIndex + 1);
    if (!NumberFormatter.isSignedInteger(exponentText)) {
      return text;
    }
    let exponent = Number(exponentText);
    if (!Number.isFinite(exponent)) {
      return text;
    }
    let dot = mantissa.indexOf('.');
    let integerPart = dot >= 0 ? mantissa.substring(0, dot) : mantissa;
    let fractionPart = dot >= 0 ? mantissa.substring(dot + 1) : '';
    let combined = NumberFormatter.trimLeadingZeros(integerPart + fractionPart);
    if (combined.length === 0) {
      return '0';
    }
    let integerNonZero = NumberFormatter.trimLeadingZeros(integerPart);
    if (integerNonZero.length > 0) {
      exponent += integerNonZero.length - 1;
      combined = integerNonZero + fractionPart;
    } else {
      let first = NumberFormatter.firstNonZero(fractionPart);
      if (first < 0) {
        return '0';
      }
      exponent -= first + 1;
      combined = fractionPart.substring(first);
    }
    return sign + NumberFormatter.toScientific(combined, exponent, maxSignificant);
  }

  private static expandToParts(text: string): DecimalParts | null {
    let sign = '';
    let body = text;
    if (body.startsWith('-')) {
      sign = '-';
      body = body.substring(1);
    } else if (body.startsWith('+')) {
      body = body.substring(1);
    }

    let eIndex = body.indexOf('e');
    if (eIndex < 0) {
      eIndex = body.indexOf('E');
    }
    let exponent = 0;
    if (eIndex >= 0) {
      let expText = body.substring(eIndex + 1);
      if (!NumberFormatter.isSignedInteger(expText)) {
        return null;
      }
      exponent = Number(expText);
      if (!Number.isFinite(exponent) || Math.abs(exponent) > 100000) {
        return null;
      }
      body = body.substring(0, eIndex);
    }

    if (!NumberFormatter.isDecimalBody(body)) {
      return null;
    }
    let dot = body.indexOf('.');
    let integerPart = dot >= 0 ? body.substring(0, dot) : body;
    let fractionPart = dot >= 0 ? body.substring(dot + 1) : '';
    if (integerPart.length === 0) {
      integerPart = '0';
    }

    let digits = integerPart + fractionPart;
    let decimalIndex = integerPart.length + exponent;
    if (decimalIndex <= 0) {
      let zeros = NumberFormatter.repeatZero(-decimalIndex);
      return new DecimalParts(sign, '0', zeros + digits);
    }
    if (decimalIndex >= digits.length) {
      let zeros = NumberFormatter.repeatZero(decimalIndex - digits.length);
      return new DecimalParts(sign, digits + zeros, '');
    }
    return new DecimalParts(sign, digits.substring(0, decimalIndex), digits.substring(decimalIndex));
  }

  private static toScientific(significantDigits: string, exponent: number, maxSignificant: number): string {
    let digits = NumberFormatter.trimLeadingZeros(significantDigits);
    if (digits.length === 0) {
      return '0';
    }
    let rounded = NumberFormatter.roundDigits(digits, maxSignificant);
    if (rounded.carry) {
      exponent += 1;
    }
    let visible = rounded.digits;
    let mantissa = visible.charAt(0);
    if (visible.length > 1) {
      mantissa += '.' + visible.substring(1);
      mantissa = NumberFormatter.trimDecimalZeros(mantissa);
    }
    return mantissa + 'e' + (exponent >= 0 ? '+' : '') + exponent.toString();
  }

  private static roundDigits(digits: string, maxSignificant: number): RoundedDigits {
    if (digits.length <= maxSignificant) {
      return new RoundedDigits(digits, false);
    }
    let kept = digits.substring(0, maxSignificant).split('');
    let shouldRound = digits.charAt(maxSignificant) >= '5';
    if (!shouldRound) {
      return new RoundedDigits(kept.join(''), false);
    }
    let index = kept.length - 1;
    while (index >= 0 && kept[index] === '9') {
      kept[index] = '0';
      index -= 1;
    }
    if (index < 0) {
      return new RoundedDigits('1' + NumberFormatter.repeatZero(maxSignificant - 1), true);
    }
    kept[index] = (Number(kept[index]) + 1).toString();
    return new RoundedDigits(kept.join(''), false);
  }

  private static limitPlainDecimal(text: string, maxFraction: number): string {
    let dot = text.indexOf('.');
    if (dot < 0) {
      return text;
    }
    let fraction = text.substring(dot + 1);
    if (fraction.length <= maxFraction) {
      return text;
    }
    return text.substring(0, dot + 1) + fraction.substring(0, maxFraction);
  }

  private static trimLeadingZeros(text: string): string {
    let i = 0;
    while (i < text.length && text.charAt(i) === '0') {
      i += 1;
    }
    return text.substring(i);
  }

  private static trimDecimalZeros(text: string): string {
    if (text.indexOf('.') < 0) {
      return text;
    }
    let result = text;
    while (result.endsWith('0')) {
      result = result.substring(0, result.length - 1);
    }
    if (result.endsWith('.')) {
      result = result.substring(0, result.length - 1);
    }
    return result.length === 0 ? '0' : result;
  }

  private static firstNonZero(text: string): number {
    for (let i = 0; i < text.length; i++) {
      if (text.charAt(i) !== '0') {
        return i;
      }
    }
    return -1;
  }

  private static repeatZero(count: number): string {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += '0';
    }
    return result;
  }

  private static isDecimalBody(text: string): boolean {
    if (text.length === 0) {
      return false;
    }
    let dotCount = 0;
    let digitCount = 0;
    for (let i = 0; i < text.length; i++) {
      let ch = text.charAt(i);
      if (ch >= '0' && ch <= '9') {
        digitCount += 1;
      } else if (ch === '.') {
        dotCount += 1;
        if (dotCount > 1) {
          return false;
        }
      } else {
        return false;
      }
    }
    return digitCount > 0;
  }

  private static isSignedInteger(text: string): boolean {
    if (text.length === 0) {
      return false;
    }
    let start = 0;
    if (text.charAt(0) === '+' || text.charAt(0) === '-') {
      start = 1;
    }
    if (start >= text.length) {
      return false;
    }
    for (let i = start; i < text.length; i++) {
      let ch = text.charAt(i);
      if (ch < '0' || ch > '9') {
        return false;
      }
    }
    return true;
  }
}
