export enum CalculatorMode {
  STANDARD = 0,
  SCIENTIFIC = 1,
  PROGRAMMER = 2
}

export enum PrecisionMode {
  HIGH = 0,
  STANDARD = 1
}

export enum AngleMode {
  DEG = 0,
  RAD = 1
}

export enum EvalError {
  NONE = 0,
  INCOMPLETE = 1,
  INVALID = 2,
  DIVIDE_BY_ZERO = 3,
  DOMAIN = 4,
  OVERFLOW = 5
}

export enum ThemeMode {
  MINIMAL = 0,
  CAT = 1,
  CUSTOM = 2
}

export enum BackgroundBlurLevel {
  CLEAR = 0,
  SOFT = 1,
  BLUR = 2
}

export enum BackgroundOverlayLevel {
  NONE = 0,
  LIGHT = 1,
  MEDIUM = 2
}

export enum TextTone {
  DARK = 0,
  LIGHT = 1
}

export class EvalResult {
  ok: boolean = false;
  valueText: string = '';
  error: EvalError = EvalError.NONE;
  errorText: string = '';

  constructor(ok: boolean, valueText: string, error: EvalError, errorText: string) {
    this.ok = ok;
    this.valueText = valueText;
    this.error = error;
    this.errorText = errorText;
  }
}

export class ProgrammerResult {
  ok: boolean = false;
  value: bigint = BigInt(0);
  error: EvalError = EvalError.NONE;
  errorText: string = '';

  constructor(ok: boolean, value: bigint, error: EvalError, errorText: string) {
    this.ok = ok;
    this.value = value;
    this.error = error;
    this.errorText = errorText;
  }
}

export class HistoryItem {
  id: string = '';
  mode: CalculatorMode = CalculatorMode.STANDARD;
  expression: string = '';
  result: string = '';
  precisionMode: PrecisionMode = PrecisionMode.HIGH;
  angleMode: AngleMode = AngleMode.DEG;
  radix: number = 10;
  bitWidth: number = 64;
  createdAt: number = 0;

  constructor(id: string, mode: CalculatorMode, expression: string, result: string,
    precisionMode: PrecisionMode, angleMode: AngleMode, radix: number, bitWidth: number,
    createdAt: number) {
    this.id = id;
    this.mode = mode;
    this.expression = expression;
    this.result = result;
    this.precisionMode = precisionMode;
    this.angleMode = angleMode;
    this.radix = radix;
    this.bitWidth = bitWidth;
    this.createdAt = createdAt;
  }
}

export interface HistoryRaw {
  id: string;
  mode: number;
  expression: string;
  result: string;
  precisionMode: number;
  angleMode: number;
  radix: number;
  bitWidth: number;
  createdAt: number;
}

export class UiSettings {
  themeMode: ThemeMode = ThemeMode.MINIMAL;
  backgroundImageUri: string = '';
  backgroundBlurLevel: BackgroundBlurLevel = BackgroundBlurLevel.SOFT;
  backgroundOverlayLevel: BackgroundOverlayLevel = BackgroundOverlayLevel.LIGHT;
  buttonOpacity: number = 0.84;
  textTone: TextTone = TextTone.DARK;

  constructor(themeMode: ThemeMode, backgroundImageUri: string,
    backgroundBlurLevel: BackgroundBlurLevel, backgroundOverlayLevel: BackgroundOverlayLevel,
    buttonOpacity: number, textTone: TextTone) {
    this.themeMode = themeMode;
    this.backgroundImageUri = backgroundImageUri;
    this.backgroundBlurLevel = backgroundBlurLevel;
    this.backgroundOverlayLevel = backgroundOverlayLevel;
    this.buttonOpacity = buttonOpacity;
    this.textTone = textTone;
  }
}

export interface UiSettingsRaw {
  themeMode: number;
  backgroundImageUri: string;
  backgroundBlurLevel: number;
  backgroundOverlayLevel: number;
  buttonOpacity: number;
  textTone: number;
}
