import { EvalError, ProgrammerResult } from '../model/CalculatorTypes';

class ProgrammerParser {
  private expression: string;
  private index: number = 0;
  private radix: number;
  private bitWidth: number;
  private mask: bigint;
  error: EvalError = EvalError.NONE;
  errorText: string = '';

  constructor(expression: string, radix: number, bitWidth: number) {
    this.expression = expression.toUpperCase();
    this.radix = radix;
    this.bitWidth = bitWidth;
    this.mask = (BigInt(1) << BigInt(bitWidth)) - BigInt(1);
  }

  parse(): bigint | null {
    this.skipSpaces();
    if (this.expression.length === 0) {
      this.setError(EvalError.INCOMPLETE, '请输入整数表达式');
      return null;
    }
    let value = this.parseOr();
    if (value === null) {
      return null;
    }
    this.skipSpaces();
    if (this.index !== this.expression.length) {
      this.setError(EvalError.INVALID, '程序员表达式格式错误');
      return null;
    }
    return this.normalize(value);
  }

  private parseOr(): bigint | null {
    let left = this.parseXor();
    if (left === null) {
      return null;
    }
    while (true) {
      this.skipSpaces();
      if (this.matchWord('OR')) {
        let right = this.parseXor();
        if (right === null) {
          return null;
        }
        left = this.normalize(left | right);
      } else {
        break;
      }
    }
    return left;
  }

  private parseXor(): bigint | null {
    let left = this.parseAnd();
    if (left === null) {
      return null;
    }
    while (true) {
      this.skipSpaces();
      if (this.matchWord('XOR')) {
        let right = this.parseAnd();
        if (right === null) {
          return null;
        }
        left = this.normalize(left ^ right);
      } else {
        break;
      }
    }
    return left;
  }

  private parseAnd(): bigint | null {
    let left = this.parseShift();
    if (left === null) {
      return null;
    }
    while (true) {
      this.skipSpaces();
      if (this.matchWord('AND')) {
        let right = this.parseShift();
        if (right === null) {
          return null;
        }
        left = this.normalize(left & right);
      } else {
        break;
      }
    }
    return left;
  }

  private parseShift(): bigint | null {
    let left = this.parseAddSub();
    if (left === null) {
      return null;
    }
    while (true) {
      this.skipSpaces();
      if (this.match('<<')) {
        let right = this.parseAddSub();
        if (right === null) {
          return null;
        }
        if (right >= BigInt(this.bitWidth)) {
          left = BigInt(0);
        } else {
          left = this.normalize(left << right);
        }
      } else if (this.match('>>')) {
        let right = this.parseAddSub();
        if (right === null) {
          return null;
        }
        if (right >= BigInt(this.bitWidth)) {
          left = BigInt(0);
        } else {
          left = this.normalize(left >> right);
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parseAddSub(): bigint | null {
    let left = this.parseMulDiv();
    if (left === null) {
      return null;
    }
    while (true) {
      this.skipSpaces();
      if (this.match('+')) {
        let right = this.parseMulDiv();
        if (right === null) {
          return null;
        }
        left = this.normalize(left + right);
      } else if (this.match('-')) {
        let right = this.parseMulDiv();
        if (right === null) {
          return null;
        }
        left = this.normalize(left - right);
      } else {
        break;
      }
    }
    return left;
  }

  private parseMulDiv(): bigint | null {
    let left = this.parseUnary();
    if (left === null) {
      return null;
    }
    while (true) {
      this.skipSpaces();
      if (this.match('×') || this.match('*')) {
        let right = this.parseUnary();
        if (right === null) {
          return null;
        }
        left = this.normalize(left * right);
      } else if (this.match('÷') || this.match('/')) {
        let right = this.parseUnary();
        if (right === null) {
          return null;
        }
        if (right === BigInt(0)) {
          this.setError(EvalError.DIVIDE_BY_ZERO, '除数不能为 0');
          return null;
        }
        left = this.normalize(left / right);
      } else if (this.matchWord('MOD')) {
        let right = this.parseUnary();
        if (right === null) {
          return null;
        }
        if (right === BigInt(0)) {
          this.setError(EvalError.DIVIDE_BY_ZERO, 'MOD 的除数不能为 0');
          return null;
        }
        left = this.normalize(left % right);
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): bigint | null {
    this.skipSpaces();
    if (this.matchWord('NOT')) {
      let value = this.parseUnary();
      if (value === null) {
        return null;
      }
      return this.normalize(this.mask ^ value);
    }
    if (this.match('-')) {
      let value = this.parseUnary();
      if (value === null) {
        return null;
      }
      return this.normalize(-value);
    }
    if (this.match('+')) {
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): bigint | null {
    this.skipSpaces();
    if (this.index >= this.expression.length) {
      this.setError(EvalError.INCOMPLETE, '请继续输入');
      return null;
    }
    if (this.match('(')) {
      let inner = this.parseOr();
      if (inner === null) {
        return null;
      }
      this.skipSpaces();
      if (!this.match(')')) {
        this.setError(EvalError.INCOMPLETE, '缺少右括号');
        return null;
      }
      return inner;
    }
    return this.parseNumber();
  }

  private parseNumber(): bigint | null {
    let start = this.index;
    while (this.index < this.expression.length && this.isValidDigit(this.expression.charAt(this.index))) {
      this.index += 1;
    }
    if (start === this.index) {
      this.setError(EvalError.INVALID, '当前进制不支持该数字');
      return null;
    }
    let text = this.expression.substring(start, this.index);
    let value = ProgrammerEngine.parseLiteral(text, this.radix);
    if (value === null) {
      this.setError(EvalError.INVALID, '整数格式错误');
      return null;
    }
    return this.normalize(value);
  }

  private isValidDigit(ch: string): boolean {
    let value = ProgrammerEngine.digitValue(ch);
    return value >= 0 && value < this.radix;
  }

  private normalize(value: bigint): bigint {
    let modulus = this.mask + BigInt(1);
    let result = value % modulus;
    if (result < BigInt(0)) {
      result += modulus;
    }
    return result & this.mask;
  }

  private skipSpaces(): void {
    while (this.index < this.expression.length && this.expression.charAt(this.index) === ' ') {
      this.index += 1;
    }
  }

  private match(text: string): boolean {
    if (this.expression.substring(this.index, this.index + text.length) === text) {
      this.index += text.length;
      return true;
    }
    return false;
  }

  private matchWord(word: string): boolean {
    let end = this.index + word.length;
    if (this.expression.substring(this.index, end) !== word) {
      return false;
    }
    if (end < this.expression.length) {
      let next = this.expression.charAt(end);
      if ((next >= 'A' && next <= 'Z') || (next >= '0' && next <= '9')) {
        return false;
      }
    }
    this.index = end;
    return true;
  }

  private setError(error: EvalError, text: string): void {
    if (this.error === EvalError.NONE || this.error === EvalError.INCOMPLETE) {
      this.error = error;
      this.errorText = text;
    }
  }
}

export default class ProgrammerEngine {
  static evaluate(expression: string, radix: number, bitWidth: number): ProgrammerResult {
    try {
      let parser = new ProgrammerParser(expression, radix, bitWidth);
      let value = parser.parse();
      if (value === null) {
        return new ProgrammerResult(false, BigInt(0), parser.error, parser.errorText);
      }
      return new ProgrammerResult(true, value, EvalError.NONE, '');
    } catch (error) {
      return new ProgrammerResult(false, BigInt(0), EvalError.INVALID, '无法计算该程序员表达式');
    }
  }

  static parseLiteral(text: string, radix: number): bigint | null {
    if (text.length === 0) {
      return null;
    }
    let result = BigInt(0);
    let base = BigInt(radix);
    for (let i = 0; i < text.length; i++) {
      let digit = ProgrammerEngine.digitValue(text.charAt(i).toUpperCase());
      if (digit < 0 || digit >= radix) {
        return null;
      }
      result = result * base + BigInt(digit);
    }
    return result;
  }

  static digitValue(ch: string): number {
    if (ch >= '0' && ch <= '9') {
      return ch.charCodeAt(0) - '0'.charCodeAt(0);
    }
    if (ch >= 'A' && ch <= 'F') {
      return ch.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
    }
    return -1;
  }

  static format(value: bigint, radix: number): string {
    return value.toString(radix).toUpperCase();
  }

  static formatBinaryGrouped(value: bigint, bitWidth: number): string {
    let raw = value.toString(2);
    while (raw.length < bitWidth) {
      raw = '0' + raw;
    }
    let firstNonZero = 0;
    while (firstNonZero < raw.length - 1 && raw.charAt(firstNonZero) === '0') {
      firstNonZero += 1;
    }
    let visible = raw.substring(firstNonZero);
    let pad = (4 - visible.length % 4) % 4;
    for (let i = 0; i < pad; i++) {
      visible = '0' + visible;
    }
    let grouped = '';
    for (let i = 0; i < visible.length; i += 4) {
      if (grouped.length > 0) {
        grouped += ' ';
      }
      grouped += visible.substring(i, i + 4);
    }
    return grouped;
  }
}
