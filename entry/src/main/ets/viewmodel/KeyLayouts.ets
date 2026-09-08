export class KeyLayouts {
  static readonly STANDARD_KEYS: Array<string> = [
    'C', '±', '%', '÷',
    '7', '8', '9', '×',
    '4', '5', '6', '-',
    '1', '2', '3', '+',
    '⌫', '0', '.', '='
  ];

  // Scientific mode is intentionally a symbol panel only. Numbers remain in the
  // standard panel, and STANDARD <-> SCIENTIFIC share the same expression/caret.
  static readonly SCIENTIFIC_KEYS: Array<string> = [
    'sin', 'cos', 'tan', '√',
    'log', 'ln', 'x²', 'xʸ',
    '(', ')', 'π', 'e',
    '1/x', '|x|', '%'
  ];

  static readonly PROGRAMMER_KEYS: Array<string> = [
    'AND', 'OR', 'XOR', 'NOT',
    '<<', '>>', 'MOD', '÷',
    'A', 'B', 'C', 'D',
    'E', 'F', '(', ')',
    '7', '8', '9', '×',
    '4', '5', '6', '-',
    '1', '2', '3', '+',
    'AC', '0', '⌫', '='
  ];
}
