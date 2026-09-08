import { Decimal } from '@kit.ArkTS';
import { AngleMode, EvalError, EvalResult, PrecisionMode } from '../model/CalculatorTypes';

class NumericValue {
  private decimalValue: Decimal | null = null;
  private numberValue: number = 0;
  private decimalMode: boolean = false;

  constructor(text: string, decimalMode: boolean) {
    this.decimalMode = decimalMode;
    if (decimalMode) {
      this.decimalValue = new Decimal(text);
      this.numberValue = Number(text);
    } else {
      this.numberValue = Number(text);
    }
  }

  static fromNumber(value: number, decimalMode: boolean): NumericValue {
    return new NumericValue(ExpressionEngine.numberToStableString(value), decimalMode);
  }

  toNumber(): number {
    if (this.decimalMode && this.decimalValue !== null) {
      return Number(this.decimalValue.toString());
    }
    return this.numberValue;
  }

  toText(): string {
    if (this.decimalMode && this.decimalValue !== null) {
      return this.decimalValue.toString();
    }
    return ExpressionEngine.numberToStableString(this.numberValue);
  }

  isZero(): boolean {
    if (this.decimalMode && this.decimalValue !== null) {
      return this.decimalValue.isZero();
    }
    return this.numberValue === 0;
  }

  isFiniteValue(): boolean {
    if (this.decimalMode && this.decimalValue !== null) {
      return this.decimalValue.isFinite() && !this.decimalValue.isNaN();
    }
    return Number.isFinite(this.numberValue) && !Number.isNaN(this.numberValue);
  }

  add(other: NumericValue): NumericValue {
    if (this.decimalMode && this.decimalValue !== null) {
      return new NumericValue(this.decimalValue.add(other.toText()).toString(), true);
    }
    return NumericValue.fromNumber(this.numberValue + other.toNumber(), false);
  }

  sub(other: NumericValue): NumericValue {
    if (this.decimalMode && this.decimalValue !== null) {
      return new NumericValue(this.decimalValue.sub(other.toText()).toString(), true);
    }
    return NumericValue.fromNumber(this.numberValue - other.toNumber(), false);
  }

  mul(other: NumericValue): NumericValue {
    if (this.decimalMode && this.decimalValue !== null) {
      return new NumericValue(this.decimalValue.mul(other.toText()).toString(), true);
    }
    return NumericValue.fromNumber(this.numberValue * other.toNumber(), false);
  }

  div(other: NumericValue): NumericValue {
    if (this.decimalMode && this.decimalValue !== null) {
      return new NumericValue(this.decimalValue.div(other.toText()).toString(), true);
    }
    return NumericValue.fromNumber(this.numberValue / other.toNumber(), false);
  }

  negate(): NumericValue {
    if (this.decimalMode && this.decimalValue !== null) {
      return new NumericValue(new Decimal(0).sub(this.decimalValue).toString(), true);
    }
    return NumericValue.fromNumber(-this.numberValue, false);
  }

  percent(): NumericValue {
    if (this.decimalMode && this.decimalValue !== null) {
      return new NumericValue(this.decimalValue.div(100).toString(), true);
    }
    return NumericValue.fromNumber(this.numberValue / 100, false);
  }
}

class Parser {
  private expression: string;
  private index: number = 0;
  private decimalMode: boolean;
  private angleMode: AngleMode;
  error: EvalError = EvalError.NONE;
  errorText: string = '';

  constructor(expression: string, decimalMode: boolean, angleMode: AngleMode) {
    this.expression = expression;
    this.decimalMode = decimalMode;
    this.angleMode = angleMode;
  }

  parse(): NumericValue | null {
    this.skipSpaces();
    if (this.expression.length === 0) {
      this.setError(EvalError.INCOMPLETE, '请输入算式');
      return null;
    }
    let value = this.parseAddSub();
    if (value === null) {
      return null;
    }
    this.skipSpaces();
    if (this.index !== this.expression.length) {
      this.setError(EvalError.INVALID, '无法计算该表达式');
      return null;
    }
    return value;
  }

  private parseAddSub(): NumericValue | null {
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
        left = left.add(right);
      } else if (this.match('-')) {
        let right = this.parseMulDiv();
        if (right === null) {
          return null;
        }
        left = left.sub(right);
      } else {
        break;
      }
    }
    return left;
  }

  private parseMulDiv(): NumericValue | null {
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
        left = left.mul(right);
      } else if (this.match('÷') || this.match('/')) {
        let right = this.parseUnary();
        if (right === null) {
          return null;
        }
        if (right.isZero()) {
          this.setError(EvalError.DIVIDE_BY_ZERO, '除数不能为 0');
          return null;
        }
        left = left.div(right);
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): NumericValue | null {
    this.skipSpaces();
    if (this.match('+')) {
      return this.parseUnary();
    }
    if (this.match('-')) {
      let value = this.parseUnary();
      if (value === null) {
        return null;
      }
      return value.negate();
    }
    return this.parsePower();
  }

  private parsePower(): NumericValue | null {
    let left = this.parsePostfix();
    if (left === null) {
      return null;
    }
    this.skipSpaces();
    if (this.match('^')) {
      let right = this.parseUnary();
      if (right === null) {
        return null;
      }
      let powerResult = Math.pow(left.toNumber(), right.toNumber());
      if (!Number.isFinite(powerResult) || Number.isNaN(powerResult)) {
        this.setError(EvalError.DOMAIN, '幂运算超出实数范围');
        return null;
      }
      return NumericValue.fromNumber(powerResult, this.decimalMode);
    }
    return left;
  }

  private parsePostfix(): NumericValue | null {
    let value = this.parsePrimary();
    if (value === null) {
      return null;
    }
    while (true) {
      this.skipSpaces();
      if (this.match('%')) {
        value = value.percent();
      } else {
        break;
      }
    }
    return value;
  }

  private parsePrimary(): NumericValue | null {
    this.skipSpaces();
    if (this.index >= this.expression.length) {
      this.setError(EvalError.INCOMPLETE, '请继续输入');
      return null;
    }

    if (this.match('(')) {
      let inner = this.parseAddSub();
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

    let current = this.peek();
    if (this.isDigit(current) || current === '.') {
      return this.parseNumber();
    }

    if (current === 'π') {
      this.index += 1;
      return NumericValue.fromNumber(Math.PI, this.decimalMode);
    }

    if (current === '√') {
      this.index += 1;
      return this.parseFunction('sqrt');
    }

    if (this.isLetter(current)) {
      let name = this.parseIdentifier();
      if (name === 'e') {
        return NumericValue.fromNumber(Math.E, this.decimalMode);
      }
      return this.parseFunction(name);
    }

    this.setError(EvalError.INVALID, '无法识别当前输入');
    return null;
  }

  private parseNumber(): NumericValue | null {
    let start = this.index;
    let dotSeen = false;
    let digitSeen = false;

    while (this.index < this.expression.length) {
      let ch = this.expression.charAt(this.index);
      if (this.isDigit(ch)) {
        digitSeen = true;
        this.index += 1;
      } else if (ch === '.' && !dotSeen) {
        dotSeen = true;
        this.index += 1;
      } else {
        break;
      }
    }

    if (!digitSeen) {
      this.setError(EvalError.INVALID, '数字格式错误');
      return null;
    }

    if (this.index < this.expression.length &&
      (this.expression.charAt(this.index) === 'e' || this.expression.charAt(this.index) === 'E')) {
      let exponentIndex = this.index;
      this.index += 1;
      if (this.index < this.expression.length &&
        (this.expression.charAt(this.index) === '+' || this.expression.charAt(this.index) === '-')) {
        this.index += 1;
      }
      let exponentStart = this.index;
      while (this.index < this.expression.length && this.isDigit(this.expression.charAt(this.index))) {
        this.index += 1;
      }
      if (exponentStart === this.index) {
        this.index = exponentIndex;
      }
    }

    let text = this.expression.substring(start, this.index);
    try {
      let value = new NumericValue(text, this.decimalMode);
      if (!value.isFiniteValue()) {
        this.setError(EvalError.OVERFLOW, '结果超出显示范围');
        return null;
      }
      return value;
    } catch (error) {
      this.setError(EvalError.INVALID, '数字格式错误');
      return null;
    }
  }

  private parseFunction(name: string): NumericValue | null {
    this.skipSpaces();
    if (!this.match('(')) {
      this.setError(EvalError.INCOMPLETE, '函数缺少左括号');
      return null;
    }
    let argument = this.parseAddSub();
    if (argument === null) {
      return null;
    }
    this.skipSpaces();
    if (!this.match(')')) {
      this.setError(EvalError.INCOMPLETE, '函数缺少右括号');
      return null;
    }

    let x = argument.toNumber();
    let result = 0;
    if (name === 'sqrt') {
      if (x < 0) {
        this.setError(EvalError.DOMAIN, '当前仅支持实数范围内的平方根');
        return null;
      }
      result = Math.sqrt(x);
    } else if (name === 'abs') {
      result = Math.abs(x);
    } else if (name === 'sin') {
      result = Math.sin(this.toRadians(x));
    } else if (name === 'cos') {
      result = Math.cos(this.toRadians(x));
    } else if (name === 'tan') {
      let rad = this.toRadians(x);
      if (Math.abs(Math.cos(rad)) < 1e-12) {
        this.setError(EvalError.DOMAIN, '当前角度下 tan 无定义');
        return null;
      }
      result = Math.tan(rad);
    } else if (name === 'log') {
      if (x <= 0) {
        this.setError(EvalError.DOMAIN, 'log 的输入必须大于 0');
        return null;
      }
      result = Math.log(x) / Math.LN10;
    } else if (name === 'ln') {
      if (x <= 0) {
        this.setError(EvalError.DOMAIN, 'ln 的输入必须大于 0');
        return null;
      }
      result = Math.log(x);
    } else {
      this.setError(EvalError.INVALID, '未知函数');
      return null;
    }

    if (!Number.isFinite(result) || Number.isNaN(result)) {
      this.setError(EvalError.OVERFLOW, '结果超出显示范围');
      return null;
    }
    return NumericValue.fromNumber(result, this.decimalMode);
  }

  private toRadians(value: number): number {
    if (this.angleMode === AngleMode.DEG) {
      return value * Math.PI / 180;
    }
    return value;
  }

  private parseIdentifier(): string {
    let start = this.index;
    while (this.index < this.expression.length && this.isLetter(this.expression.charAt(this.index))) {
      this.index += 1;
    }
    return this.expression.substring(start, this.index);
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

  private peek(): string {
    if (this.index >= this.expression.length) {
      return '';
    }
    return this.expression.charAt(this.index);
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isLetter(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
  }

  private setError(error: EvalError, text: string): void {
    if (this.error === EvalError.NONE || this.error === EvalError.INCOMPLETE) {
      this.error = error;
      this.errorText = text;
    }
  }
}

export default class ExpressionEngine {
  static evaluate(expression: string, precisionMode: PrecisionMode, angleMode: AngleMode): EvalResult {
    let useDecimal = precisionMode === PrecisionMode.HIGH;
    try {
      if (useDecimal) {
        Decimal.set({ precision: 50 });
      }
      let parser = new Parser(expression, useDecimal, angleMode);
      let value = parser.parse();
      if (value === null) {
        return new EvalResult(false, '', parser.error, parser.errorText);
      }
      if (!value.isFiniteValue()) {
        return new EvalResult(false, '', EvalError.OVERFLOW, '结果超出显示范围');
      }
      return new EvalResult(true, value.toText(), EvalError.NONE, '');
    } catch (error) {
      return new EvalResult(false, '', EvalError.INVALID, '无法计算该表达式');
    }
  }

  static numberToStableString(value: number): string {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      return 'NaN';
    }
    if (value === 0 || Math.abs(value) < 1e-15) {
      return '0';
    }
    let absValue = Math.abs(value);
    if (absValue >= 1e16 || absValue < 1e-10) {
      return value.toExponential(12).replace(/\.0+e/, 'e').replace(/(\.\d*?)0+e/, '$1e');
    }
    let text = value.toPrecision(15);
    if (text.indexOf('e') !== -1 || text.indexOf('E') !== -1) {
      return Number(text).toString();
    }
    if (text.indexOf('.') !== -1) {
      while (text.endsWith('0')) {
        text = text.substring(0, text.length - 1);
      }
      if (text.endsWith('.')) {
        text = text.substring(0, text.length - 1);
      }
    }
    return text;
  }
}
