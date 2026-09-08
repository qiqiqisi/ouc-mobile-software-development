export class EditResult {
  text: string = '';
  selectionStart: number = 0;
  selectionEnd: number = 0;

  constructor(text: string, selectionStart: number, selectionEnd: number) {
    this.text = text;
    this.selectionStart = selectionStart;
    this.selectionEnd = selectionEnd;
  }
}

export default class ExpressionEditor {
  static clampPosition(text: string, value: number): number {
    if (value < 0) {
      return 0;
    }
    if (value > text.length) {
      return text.length;
    }
    return value;
  }

  static normalizedStart(text: string, start: number, end: number): number {
    let a = ExpressionEditor.clampPosition(text, start);
    let b = ExpressionEditor.clampPosition(text, end);
    return Math.min(a, b);
  }

  static normalizedEnd(text: string, start: number, end: number): number {
    let a = ExpressionEditor.clampPosition(text, start);
    let b = ExpressionEditor.clampPosition(text, end);
    return Math.max(a, b);
  }

  static replaceSelection(text: string, start: number, end: number, replacement: string,
    caretOffset: number = -1): EditResult {
    let s = ExpressionEditor.normalizedStart(text, start, end);
    let e = ExpressionEditor.normalizedEnd(text, start, end);
    let updated = text.substring(0, s) + replacement + text.substring(e);
    let caret = caretOffset >= 0 ? s + caretOffset : s + replacement.length;
    return new EditResult(updated, caret, caret);
  }

  static insert(text: string, start: number, end: number, value: string): EditResult {
    return ExpressionEditor.replaceSelection(text, start, end, value);
  }

  static deleteBackward(text: string, start: number, end: number): EditResult {
    let s = ExpressionEditor.normalizedStart(text, start, end);
    let e = ExpressionEditor.normalizedEnd(text, start, end);
    if (s !== e) {
      return ExpressionEditor.replaceSelection(text, s, e, '', 0);
    }
    if (s <= 0) {
      return new EditResult(text, 0, 0);
    }
    let updated = text.substring(0, s - 1) + text.substring(s);
    return new EditResult(updated, s - 1, s - 1);
  }

  static wrap(text: string, start: number, end: number, prefix: string, suffix: string,
    caretInsideWhenEmpty: boolean = true): EditResult {
    let s = ExpressionEditor.normalizedStart(text, start, end);
    let e = ExpressionEditor.normalizedEnd(text, start, end);
    let selected = text.substring(s, e);
    if (selected.length > 0) {
      let replacement = prefix + selected + suffix;
      return ExpressionEditor.replaceSelection(text, s, e, replacement);
    }
    let replacement = prefix + suffix;
    let caretOffset = caretInsideWhenEmpty ? prefix.length : replacement.length;
    return ExpressionEditor.replaceSelection(text, s, e, replacement, caretOffset);
  }

  static toggleSign(text: string, start: number, end: number): EditResult {
    let s = ExpressionEditor.normalizedStart(text, start, end);
    let e = ExpressionEditor.normalizedEnd(text, start, end);
    if (s !== e) {
      let selected = text.substring(s, e);
      if (selected.startsWith('-(') && selected.endsWith(')') && selected.length >= 4) {
        let inner = selected.substring(2, selected.length - 1);
        return ExpressionEditor.replaceSelection(text, s, e, inner);
      }
      if (selected.startsWith('-') && selected.length > 1) {
        return ExpressionEditor.replaceSelection(text, s, e, selected.substring(1));
      }
      return ExpressionEditor.replaceSelection(text, s, e, '-(' + selected + ')');
    }

    let caret = s;
    let range = ExpressionEditor.findNumberRange(text, caret);
    if (range[0] < 0) {
      return ExpressionEditor.insert(text, caret, caret, '-');
    }
    let tokenStart = range[0];
    let tokenEnd = range[1];

    if (tokenStart > 0) {
      let before = text.charAt(tokenStart - 1);
      if (before === '+') {
        let updated = text.substring(0, tokenStart - 1) + '-' + text.substring(tokenStart);
        return new EditResult(updated, caret, caret);
      }
      if (before === '-') {
        let beforeBefore = tokenStart - 2 >= 0 ? text.charAt(tokenStart - 2) : '';
        if (tokenStart - 1 === 0 || ExpressionEditor.isOperatorOrOpen(beforeBefore)) {
          let updated = text.substring(0, tokenStart - 1) + text.substring(tokenStart);
          return new EditResult(updated, Math.max(0, caret - 1), Math.max(0, caret - 1));
        }
        let updated = text.substring(0, tokenStart - 1) + '+' + text.substring(tokenStart);
        return new EditResult(updated, caret, caret);
      }
    }

    let updated = text.substring(0, tokenStart) + '-' + text.substring(tokenStart);
    let newCaret = caret + 1;
    if (caret > tokenEnd) {
      newCaret = tokenEnd + 1;
    }
    return new EditResult(updated, newCaret, newCaret);
  }

  private static findNumberRange(text: string, caret: number): Array<number> {
    let c = ExpressionEditor.clampPosition(text, caret);
    let probe = c;
    if (probe >= text.length || !ExpressionEditor.isNumberCharAt(text, probe)) {
      if (probe > 0 && ExpressionEditor.isNumberCharAt(text, probe - 1)) {
        probe -= 1;
      } else {
        return [-1, -1];
      }
    }
    let left = probe;
    while (left > 0 && ExpressionEditor.isNumberCharAt(text, left - 1)) {
      left -= 1;
    }
    let right = probe + 1;
    while (right < text.length && ExpressionEditor.isNumberCharAt(text, right)) {
      right += 1;
    }
    return [left, right];
  }

  private static isNumberCharAt(text: string, index: number): boolean {
    if (index < 0 || index >= text.length) {
      return false;
    }
    let ch = text.charAt(index);
    if ((ch >= '0' && ch <= '9') || ch === '.' || ch === 'e' || ch === 'E') {
      return true;
    }
    if ((ch === '+' || ch === '-') && index > 0) {
      let before = text.charAt(index - 1);
      return before === 'e' || before === 'E';
    }
    return false;
  }

  private static isOperatorOrOpen(ch: string): boolean {
    return ch.length === 0 || ch === '+' || ch === '-' || ch === '×' || ch === '*' || ch === '÷' ||
      ch === '/' || ch === '^' || ch === '(';
  }

}
