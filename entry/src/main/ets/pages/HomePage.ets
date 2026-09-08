import { common } from '@kit.AbilityKit';
import ExpressionEditor, { EditResult } from '../editor/ExpressionEditor';
import ExpressionEngine from '../engine/ExpressionEngine';
import ProgrammerEngine from '../engine/ProgrammerEngine';
import CalculatorService from '../service/CalculatorService';
import NumberFormatter from '../engine/NumberFormatter';
import { KeyLayouts } from '../viewmodel/KeyLayouts';
import {
  AngleMode,
  BackgroundBlurLevel,
  BackgroundOverlayLevel,
  CalculatorMode,
  EvalError,
  HistoryItem,
  PrecisionMode,
  TextTone,
  ThemeMode,
  UiSettings
} from '../model/CalculatorTypes';

@Entry
@Component
struct HomePage {
  @State mode: CalculatorMode = CalculatorMode.STANDARD;

  // STANDARD and SCIENTIFIC intentionally share one editable workspace.
  @State normalExpression: string = '';
  @State normalResult: string = '0';
  @State normalErrorText: string = '';
  private normalSelectionStart: number = 0;
  private normalSelectionEnd: number = 0;
  @State precisionMode: PrecisionMode = PrecisionMode.HIGH;
  @State angleMode: AngleMode = AngleMode.DEG;

  // PROGRAMMER keeps an independent workspace so switching modes never destroys work.
  @State programExpression: string = '';
  @State programResult: string = '0';
  @State programErrorText: string = '';
  private programSelectionStart: number = 0;
  private programSelectionEnd: number = 0;
  @State radix: number = 10;
  @State bitWidth: number = 64;
  @State programHex: string = '0';
  @State programDec: string = '0';
  @State programOct: string = '0';
  @State programBin: string = '0';

  @State historyItems: Array<HistoryItem> = [];
  @State overlayType: string = '';
  @State noticeText: string = '';

  // Theme settings are low-frequency state. They are never touched by key presses.
  @State themeMode: ThemeMode = ThemeMode.MINIMAL;
  @State backgroundImageUri: string = '';
  @State backgroundBlurLevel: BackgroundBlurLevel = BackgroundBlurLevel.SOFT;
  @State backgroundOverlayLevel: BackgroundOverlayLevel = BackgroundOverlayLevel.LIGHT;
  @State buttonOpacity: number = 0.84;
  @State textTone: TextTone = TextTone.DARK;

  private readonly maxHistoryCount: number = 50;
  private service: CalculatorService = new CalculatorService();
  private uiContext = this.getUIContext();
  private normalInputController: TextInputController = new TextInputController();
  private programInputController: TextInputController = new TextInputController();

  @StorageLink('topRectHeight') topRectHeight: number = 0;
  @StorageLink('bottomRectHeight') bottomRectHeight: number = 0;

  aboutToAppear(): void {
    let context = this.uiContext.getHostContext() as common.Context;
    this.service.init(context);
    this.historyItems = this.service.loadHistory();
    let settings = this.service.loadUiSettings();
    this.themeMode = settings.themeMode;
    this.backgroundImageUri = settings.backgroundImageUri;
    this.backgroundBlurLevel = settings.backgroundBlurLevel;
    this.backgroundOverlayLevel = settings.backgroundOverlayLevel;
    this.buttonOpacity = settings.buttonOpacity;
    this.textTone = settings.textTone;
    this.updateNormalPreview();
    this.updateProgramPreview();
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      this.BackgroundLayer();
      Column() {
        this.Header();
        this.ModeTabs();
        this.DisplayPanel();
        this.CompactToolbar();

        if (this.mode === CalculatorMode.STANDARD) {
          this.StandardKeyboard();
        } else if (this.mode === CalculatorMode.SCIENTIFIC) {
          this.ScientificSymbolPanel();
        } else {
          this.ProgrammerKeyboard();
        }
      }
      .width('100%')
      .height('100%')
      .padding({ bottom: this.uiContext.px2vp(this.bottomRectHeight) });

      if (this.overlayType.length > 0) {
        this.OverlayLayer();
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.pageBackgroundColor());
  }

  @Builder
  BackgroundLayer() {
    if (this.themeMode === ThemeMode.CUSTOM && this.backgroundImageUri.length > 0) {
      Image(this.backgroundImageUri)
        .width('100%')
        .height('100%')
        .objectFit(ImageFit.Cover)
        .blur(this.backgroundBlurRadius());
      Column() {}
        .width('100%')
        .height('100%')
        .backgroundColor(this.backgroundOverlayColor());
    } else {
      Column() {}
        .width('100%')
        .height('100%')
        .backgroundColor(this.pageBackgroundColor());
    }
  }

  @Builder
  Header() {
    Row() {
      Column() {
        Text(this.themeMode === ThemeMode.CAT ? 'HAJIMI CALC' : 'Calculator')
          .fontSize(27)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.primaryTextColor());
        Text(this.themeMode === ThemeMode.CAT ? '算不明白的，让哈吉米算。' : '标准 · 科学 · 程序员')
          .fontSize(12)
          .fontColor(this.secondaryTextColor())
          .margin({ top: 2 });
      }
      .alignItems(HorizontalAlign.Start);

      Row({ space: 8 }) {
        if (this.noticeText.length > 0) {
          Text(this.noticeText)
            .fontSize(11)
            .fontColor(this.accentColor())
            .maxLines(1);
        }
        Button('◐')
          .width(36)
          .height(32)
          .fontSize(17)
          .fontColor(this.primaryTextColor())
          .backgroundColor(this.utilityButtonBackground())
          .borderRadius(12)
          .hoverEffect(HoverEffect.Scale)
          .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.96 })
          .onClick(() => {
            this.overlayType = 'appearance';
            this.noticeText = '';
          });
      }
    }
    .height(66)
    .width('100%')
    .padding({ left: 18, right: 18 })
    .margin({ top: this.uiContext.px2vp(this.topRectHeight) })
    .alignItems(VerticalAlign.Center)
    .justifyContent(FlexAlign.SpaceBetween);
  }

  @Builder
  ModeTabs() {
    Row() {
      this.ModeTab('标准', CalculatorMode.STANDARD);
      this.ModeTab('科学', CalculatorMode.SCIENTIFIC);
      this.ModeTab('程序员', CalculatorMode.PROGRAMMER);
    }
    .width('100%')
    .height(48)
    .padding({ left: 16, right: 16 })
    .justifyContent(FlexAlign.SpaceBetween)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  ModeTab(text: string, targetMode: CalculatorMode) {
    Button(text)
      .width('31%')
      .height(36)
      .fontSize(15)
      .fontWeight(this.mode === targetMode ? FontWeight.Bold : FontWeight.Medium)
      .fontColor(this.mode === targetMode ? this.activeTabTextColor() : this.secondaryTextColor())
      .backgroundColor(this.mode === targetMode ? this.activeTabBackground() : this.inactiveTabBackground())
      .borderRadius(12)
      .focusable(false)
      .hoverEffect(HoverEffect.Scale)
      .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.97 })
      .onClick(() => {
        this.switchMode(targetMode);
      });
  }

  @Builder
  DisplayPanel() {
    Stack({ alignContent: Alignment.BottomStart }) {
      if (this.themeMode === ThemeMode.CAT && this.mode !== CalculatorMode.PROGRAMMER) {
        Image($r('app.media.hajimi_compute'))
          .width(this.normalExpression.length > 12 ? 92 : 118)
          .height(this.normalExpression.length > 12 ? 62 : 78)
          .objectFit(ImageFit.Contain)
          .opacity(this.normalExpression.length > 12 ? 0.18 : 0.64)
          .margin({ left: 10, bottom: 3 });
      }

      if (this.mode === CalculatorMode.PROGRAMMER) {
        this.ProgrammerDisplayContent();
      } else {
        this.NormalDisplayContent();
      }
    }
    .width('92%')
    .height(this.mode === CalculatorMode.PROGRAMMER ? 150 : 172)
    .margin({ left: 16, right: 16, top: 2 })
    .backgroundColor(this.panelBackgroundColor())
    .borderRadius(20)
    .shadow({ radius: 10, color: this.panelShadowColor(), offsetX: 0, offsetY: 3 });
  }

  @Builder
  NormalDisplayContent() {
    Column() {
      TextInput({
        text: this.normalExpression,
        placeholder: '0',
        controller: this.normalInputController
      })
        .id('normalExpressionInput')
        .focusable(true)
        .width('100%')
        .height(50)
        .fontSize(this.normalExpressionFontSize())
        .fontColor(this.expressionTextColor())
        .textAlign(TextAlign.End)
        .backgroundColor('#00000000')
        .border({ width: 0 })
        .padding(0)
        .caretColor(this.accentColor())
        .focusOnTouch(true)
        .enableKeyboardOnFocus(false)
        .onTextSelectionChange((start: number, end: number) => {
          this.normalSelectionStart = start;
          this.normalSelectionEnd = end;
        })
        .onChange((value: string) => {
          this.normalExpression = value;
          this.updateNormalPreview();
        });

      Text(this.normalDisplayText())
        .width('100%')
        .fontSize(this.normalResult === 'NaN' ? 36 : this.normalResultFontSize())
        .fontWeight(FontWeight.Bold)
        .fontColor(this.normalResult === 'NaN' ? this.errorColor() : this.primaryTextColor())
        .textAlign(TextAlign.End)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 2 });

      Row() {
        Text(this.normalErrorText.length > 0 ? this.normalErrorText : this.normalEnvironmentLabel())
          .fontSize(11)
          .fontColor(this.normalErrorText.length > 0 ? this.errorColor() : this.secondaryTextColor())
          .maxLines(1);
        if (this.mode === CalculatorMode.SCIENTIFIC) {
          Button(this.angleMode === AngleMode.DEG ? 'DEG ▾' : 'RAD ▾')
            .height(28)
            .fontSize(11)
            .fontColor(this.accentColor())
            .backgroundColor(this.utilityButtonBackground())
            .borderRadius(9)
            .focusable(false)
            .hoverEffect(HoverEffect.Scale)
            .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.96 })
            .onClick(() => {
              this.angleMode = this.angleMode === AngleMode.DEG ? AngleMode.RAD : AngleMode.DEG;
              this.noticeText = this.angleMode === AngleMode.DEG ? 'DEG' : 'RAD';
              this.updateNormalPreview();
            });
        }
      }
      .width('100%')
      .height(30)
      .justifyContent(FlexAlign.SpaceBetween)
      .alignItems(VerticalAlign.Center)
      .margin({ top: 4 });
    }
    .width('100%')
    .height('100%')
    .padding({ left: 18, right: 18, top: 13, bottom: 9 })
    .justifyContent(FlexAlign.Center);
  }

  @Builder
  ProgrammerDisplayContent() {
    Column() {
      Row() {
        Button(this.radixLabel(this.radix) + ' ▾')
          .height(28)
          .fontSize(11)
          .fontColor(this.accentColor())
          .backgroundColor(this.utilityButtonBackground())
          .borderRadius(9)
          .focusable(false)
          .hoverEffect(HoverEffect.Scale)
          .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.96 })
          .onClick(() => {
            this.overlayType = 'radix';
          });
        Button(this.bitWidth.toString() + ' bit ▾')
          .height(28)
          .fontSize(11)
          .fontColor(this.primaryTextColor())
          .backgroundColor(this.utilityButtonBackground())
          .borderRadius(9)
          .focusable(false)
          .hoverEffect(HoverEffect.Scale)
          .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.96 })
          .onClick(() => {
            this.overlayType = 'bit';
          });
      }
      .width('100%')
      .justifyContent(FlexAlign.SpaceBetween);

      TextInput({
        text: this.programExpression,
        placeholder: '0',
        controller: this.programInputController
      })
        .id('programExpressionInput')
        .focusable(true)
        .width('100%')
        .height(40)
        .fontSize(this.programExpression.length > 20 ? 20 : 25)
        .fontColor(this.expressionTextColor())
        .textAlign(TextAlign.End)
        .backgroundColor('#00000000')
        .border({ width: 0 })
        .padding(0)
        .caretColor(this.accentColor())
        .focusOnTouch(true)
        .enableKeyboardOnFocus(false)
        .onTextSelectionChange((start: number, end: number) => {
          this.programSelectionStart = start;
          this.programSelectionEnd = end;
        })
        .onChange((value: string) => {
          this.programExpression = value.toUpperCase();
          this.updateProgramPreview();
        });

      Row() {
        Text(this.programResult)
          .layoutWeight(1)
          .fontSize(this.programResult === 'NaN' ? 30 : 34)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.programResult === 'NaN' ? this.errorColor() : this.primaryTextColor())
          .textAlign(TextAlign.End)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .width('100%');

      if (this.programErrorText.length > 0) {
        Text(this.programErrorText)
          .width('100%')
          .fontSize(10)
          .fontColor(this.errorColor())
          .textAlign(TextAlign.End)
          .maxLines(1);
      }
    }
    .width('100%')
    .height('100%')
    .padding({ left: 18, right: 18, top: 10, bottom: 8 });
  }

  @Builder
  BaseRow(label: string, value: string, active: boolean) {
    Row() {
      Text(label)
        .width(38)
        .fontSize(10)
        .fontWeight(FontWeight.Bold)
        .fontColor(active ? this.accentColor() : this.secondaryTextColor());
      Text(value)
        .layoutWeight(1)
        .fontSize(10)
        .fontColor(active ? this.primaryTextColor() : this.secondaryTextColor())
        .textAlign(TextAlign.End)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .height(18)
    .width('100%');
  }

  @Builder
  CompactToolbar() {
    Row() {
      Button('◷ 历史')
        .width('30%')
        .height(34)
        .fontSize(12)
        .fontColor(this.primaryTextColor())
        .backgroundColor(this.utilityButtonBackground())
        .borderRadius(11)
        .hoverEffect(HoverEffect.Scale)
        .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.96 })
        .onClick(() => {
          this.overlayType = 'history';
          this.noticeText = '';
        });

      Button('⧉ 复制')
        .width('30%')
        .height(34)
        .fontSize(12)
        .fontColor(this.canCopyResult() ? this.accentColor() : this.secondaryTextColor())
        .backgroundColor(this.utilityButtonBackground())
        .borderRadius(11)
        .enabled(this.canCopyResult())
        .opacity(this.canCopyResult() ? 1 : 0.45)
        .hoverEffect(HoverEffect.Scale)
        .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.96 })
        .onClick(() => {
          this.copyResult();
        });

      Button('⚙ 设置')
        .width('30%')
        .height(34)
        .fontSize(12)
        .fontColor(this.primaryTextColor())
        .backgroundColor(this.utilityButtonBackground())
        .borderRadius(11)
        .hoverEffect(HoverEffect.Scale)
        .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.96 })
        .onClick(() => {
          this.overlayType = 'settings';
          this.noticeText = '';
        });
    }
    .width('100%')
    .height(48)
    .padding({ left: 16, right: 16 })
    .justifyContent(FlexAlign.SpaceBetween)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  StandardKeyboard() {
    Grid() {
      ForEach(KeyLayouts.STANDARD_KEYS, (key: string) => {
        GridItem() {
          this.StandardKey(key);
        }
      });
    }
    .columnsTemplate('1fr 1fr 1fr 1fr')
    .columnsGap(10)
    .rowsGap(10)
    .width('100%')
    .layoutWeight(1)
    .padding({ left: 16, right: 16, top: 8, bottom: 16 })
    .backgroundColor(this.keyboardBackgroundColor())
    .borderRadius({ topLeft: 20, topRight: 20 });
  }

  @Builder
  StandardKey(key: string) {
    Button(key)
      .width('100%')
      .height(54)
      .fontSize(18)
      .fontWeight(key === '=' ? FontWeight.Bold : FontWeight.Medium)
      .fontColor(this.standardKeyTextColor(key))
      .backgroundColor(this.standardKeyBackground(key))
      .borderRadius(16)
      .shadow({ radius: 7, color: this.keyShadowColor(), offsetX: 0, offsetY: 2 })
      .focusable(false)
      .hoverEffect(HoverEffect.Scale)
      .clickEffect({ level: ClickEffectLevel.LIGHT, scale: key === '=' ? 0.92 : 0.96 })
      .onClick(() => {
        this.handleStandardKey(key);
      });
  }

  @Builder
  ScientificSymbolPanel() {
    Column() {
      Row() {
        Text('科学符号')
          .fontSize(12)
          .fontColor(this.secondaryTextColor());
        Text('数字与基础运算请切回“标准”')
          .fontSize(10)
          .fontColor(this.secondaryTextColor());
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 10, bottom: 4 })
      .justifyContent(FlexAlign.SpaceBetween);

      Grid() {
        ForEach(KeyLayouts.SCIENTIFIC_KEYS, (key: string) => {
          GridItem() {
            Button(key)
              .width('100%')
              .height(48)
              .fontSize(key.length > 2 ? 14 : 16)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.primaryTextColor())
              .backgroundColor(this.scientificKeyBackground())
              .borderRadius(15)
              .shadow({ radius: 7, color: this.keyShadowColor(), offsetX: 0, offsetY: 2 })
              .focusable(false)
              .hoverEffect(HoverEffect.Scale)
              .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.96 })
              .onClick(() => {
                this.handleScientificKey(key);
              });
          }
        });
      }
      .columnsTemplate('1fr 1fr 1fr 1fr')
      .columnsGap(10)
      .rowsGap(10)
      .width('100%')
      .height(242)
      .padding({ left: 16, right: 16, top: 8, bottom: 12 });
    }
    .layoutWeight(1)
    .width('100%')
    .backgroundColor(this.keyboardBackgroundColor())
    .borderRadius({ topLeft: 20, topRight: 20 });
  }

  @Builder
  ProgrammerKeyboard() {
    Grid() {
      ForEach(KeyLayouts.PROGRAMMER_KEYS, (key: string) => {
        GridItem() {
          Button(key)
            .width('100%')
            .height(39)
            .fontSize(key.length > 2 ? 11 : 14)
            .fontWeight(key === '=' ? FontWeight.Bold : FontWeight.Medium)
            .fontColor(this.programKeyTextColor(key))
            .backgroundColor(this.programKeyBackground(key))
            .borderRadius(13)
            .shadow({ radius: 6, color: this.keyShadowColor(), offsetX: 0, offsetY: 2 })
            .focusable(false)
            .enabled(this.isProgramKeyEnabled(key))
            .opacity(this.isProgramKeyEnabled(key) ? 1 : 0.26)
            .hoverEffect(HoverEffect.Scale)
            .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.96 })
            .onClick(() => {
              this.handleProgramKey(key);
            });
        }
      });
    }
    .columnsTemplate('1fr 1fr 1fr 1fr')
    .columnsGap(8)
    .rowsGap(6)
    .width('100%')
    .layoutWeight(1)
    .padding({ left: 16, right: 16, top: 7, bottom: 12 })
    .backgroundColor(this.keyboardBackgroundColor())
    .borderRadius({ topLeft: 20, topRight: 20 });
  }

  @Builder
  OverlayLayer() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {}
        .width('100%')
        .height('100%')
        .backgroundColor('#66000000')
        .onClick(() => {
          this.closeOverlay(false);
        });

      if (this.overlayType === 'history') {
        this.HistorySheet();
      } else if (this.overlayType === 'settings') {
        this.SettingsSheet();
      } else if (this.overlayType === 'appearance') {
        this.AppearanceSheet();
      } else if (this.overlayType === 'radix') {
        this.RadixSheet();
      } else if (this.overlayType === 'bit') {
        this.BitWidthSheet();
      }
    }
    .width('100%')
    .height('100%')
    .zIndex(20);
  }

  @Builder
  SheetHeader(title: string, subtitle: string = '') {
    Row() {
      Column() {
        Text(title)
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor('#171719');
        if (subtitle.length > 0) {
          Text(subtitle)
            .fontSize(11)
            .fontColor('#8A8A90')
            .margin({ top: 2 });
        }
      }
      .alignItems(HorizontalAlign.Start);
      Button('完成')
        .height(30)
        .fontSize(12)
        .fontColor('#3478F6')
        .backgroundColor('#E9F0FF')
        .borderRadius(9)
        .onClick(() => {
          this.closeOverlay(true);
        });
    }
    .width('100%')
    .padding({ left: 18, right: 18, top: 16, bottom: 12 })
    .justifyContent(FlexAlign.SpaceBetween)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  HistorySheet() {
    Column() {
      Row() {
        Column() {
          Text('计算历史')
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor('#171719');
          Text('最近 50 条 · 点击恢复表达式和环境')
            .fontSize(11)
            .fontColor('#8A8A90')
            .margin({ top: 2 });
        }
        .alignItems(HorizontalAlign.Start);
        Row({ space: 8 }) {
          Button('清空')
            .height(30)
            .fontSize(12)
            .fontColor('#C53A3A')
            .backgroundColor('#FBEAEA')
            .borderRadius(9)
            .enabled(this.historyItems.length > 0)
            .opacity(this.historyItems.length > 0 ? 1 : 0.4)
            .onClick(() => {
              this.historyItems = [];
              this.service.saveHistory(this.historyItems);
            });
          Button('关闭')
            .height(30)
            .fontSize(12)
            .fontColor('#3478F6')
            .backgroundColor('#E9F0FF')
            .borderRadius(9)
            .onClick(() => {
              this.overlayType = '';
            });
        }
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 16, bottom: 12 })
      .justifyContent(FlexAlign.SpaceBetween)
      .alignItems(VerticalAlign.Center);

      if (this.historyItems.length === 0) {
        Column() {
          Text('暂无历史记录')
            .fontSize(17)
            .fontColor('#8A8A90');
          Text('完成一次“=”计算后自动保存')
            .fontSize(12)
            .fontColor('#AAAAAF')
            .margin({ top: 6 });
        }
        .layoutWeight(1)
        .width('100%')
        .justifyContent(FlexAlign.Center);
      } else {
        Scroll() {
          Column() {
            ForEach(this.historyItems, (item: HistoryItem) => {
              Column() {
                Row() {
                  Text(this.historyModeLabel(item))
                    .fontSize(11)
                    .fontWeight(FontWeight.Bold)
                    .fontColor('#3478F6');
                  Text(this.historyEnvironmentLabel(item))
                    .fontSize(10)
                    .fontColor('#96969B');
                }
                .width('100%')
                .justifyContent(FlexAlign.SpaceBetween);
                Text(item.expression)
                  .width('100%')
                  .fontSize(16)
                  .fontColor('#4A4A50')
                  .textAlign(TextAlign.Start)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                  .margin({ top: 5 });
                Text('= ' + item.result)
                  .width('100%')
                  .fontSize(20)
                  .fontWeight(FontWeight.Bold)
                  .fontColor('#171719')
                  .textAlign(TextAlign.End)
                  .maxLines(1)
                  .margin({ top: 4 });
              }
              .width('100%')
              .padding({ left: 14, right: 14, top: 12, bottom: 12 })
              .margin({ left: 16, right: 16, bottom: 9 })
              .backgroundColor('#FFFFFF')
              .borderRadius(14)
              .onClick(() => {
                this.restoreHistory(item);
              });
            }, (item: HistoryItem) => item.id);
          }
          .width('100%');
        }
        .layoutWeight(1)
        .width('100%');
      }
    }
    .width('100%')
    .height('76%')
    .backgroundColor('#F7F7F8')
    .borderRadius({ topLeft: 24, topRight: 24 });
  }

  @Builder
  SettingsSheet() {
    Column() {
      this.SheetHeader('计算设置', '低频选项收在这里，避免主界面拥挤');

      Text('计算精度')
        .width('100%')
        .fontSize(12)
        .fontColor('#8A8A90')
        .padding({ left: 18, right: 18, top: 6, bottom: 8 });
      Row() {
        this.PrecisionChoiceButton('高精度 Decimal', PrecisionMode.HIGH);
        this.PrecisionChoiceButton('标准 Number', PrecisionMode.STANDARD);
      }
      .width('100%')
      .padding({ left: 18, right: 18 })
      .justifyContent(FlexAlign.SpaceBetween);

      Text('说明：Decimal 用于基础十进制四则；sin/cos/log 等科学函数仍使用数学函数能力。')
        .width('100%')
        .fontSize(11)
        .fontColor('#96969B')
        .padding({ left: 18, right: 18, top: 10 });
    }
    .width('100%')
    .height(250)
    .backgroundColor('#F7F7F8')
    .borderRadius({ topLeft: 24, topRight: 24 });
  }

  @Builder
  PrecisionChoiceButton(text: string, target: PrecisionMode) {
    Button(text)
      .width('48%')
      .height(44)
      .fontSize(13)
      .fontWeight(this.precisionMode === target ? FontWeight.Bold : FontWeight.Medium)
      .fontColor(this.precisionMode === target ? '#FFFFFF' : '#4A4A50')
      .backgroundColor(this.precisionMode === target ? '#242428' : '#ECECEF')
      .borderRadius(13)
      .hoverEffect(HoverEffect.Scale)
      .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.97 })
      .onClick(() => {
        this.precisionMode = target;
        this.updateNormalPreview();
      });
  }

  @Builder
  AppearanceSheet() {
    Column() {
      this.SheetHeader('外观', '三套风格共用同一套计算逻辑');

      Row() {
        this.ThemeChoice('简洁', '黑白灰 · 清爽', ThemeMode.MINIMAL);
        this.ThemeChoice('小猫', '哈吉米 · 暖色', ThemeMode.CAT);
        this.ThemeChoice('自定义', '照片背景 · 半透明', ThemeMode.CUSTOM);
      }
      .width('100%')
      .padding({ left: 14, right: 14 })
      .justifyContent(FlexAlign.SpaceBetween);

      if (this.themeMode === ThemeMode.CUSTOM) {
        Column() {
          Row() {
            Text(this.backgroundImageUri.length > 0 ? '背景图片已选择' : '还没有背景图片')
              .fontSize(12)
              .fontColor('#66666B');
            Button('选择图片')
              .height(30)
              .fontSize(12)
              .fontColor('#3478F6')
              .backgroundColor('#E9F0FF')
              .borderRadius(9)
              .onClick(() => {
                this.selectCustomBackground();
              });
          }
          .width('100%')
          .justifyContent(FlexAlign.SpaceBetween)
          .alignItems(VerticalAlign.Center);

          Text('背景清晰度')
            .width('100%')
            .fontSize(11)
            .fontColor('#8A8A90')
            .margin({ top: 12, bottom: 6 });
          Row() {
            this.BlurChoice('清晰', BackgroundBlurLevel.CLEAR);
            this.BlurChoice('柔和', BackgroundBlurLevel.SOFT);
            this.BlurChoice('模糊', BackgroundBlurLevel.BLUR);
          }
          .width('100%')
          .justifyContent(FlexAlign.SpaceBetween);

          Text('背景遮罩')
            .width('100%')
            .fontSize(11)
            .fontColor('#8A8A90')
            .margin({ top: 12, bottom: 6 });
          Row() {
            this.OverlayChoice('无', BackgroundOverlayLevel.NONE);
            this.OverlayChoice('轻', BackgroundOverlayLevel.LIGHT);
            this.OverlayChoice('中', BackgroundOverlayLevel.MEDIUM);
          }
          .width('100%')
          .justifyContent(FlexAlign.SpaceBetween);

          Row() {
            Text('按钮不透明度')
              .fontSize(11)
              .fontColor('#8A8A90');
            Text(Math.round(this.buttonOpacity * 100).toString() + '%')
              .fontSize(11)
              .fontColor('#4A4A50');
          }
          .width('100%')
          .margin({ top: 12 });
          Slider({ value: this.buttonOpacity * 100, min: 60, max: 100, step: 1 })
            .width('100%')
            .selectedColor('#3478F6')
            .onChange((value: number) => {
              this.buttonOpacity = value / 100;
            });

          Row() {
            Text('文字颜色')
              .fontSize(11)
              .fontColor('#8A8A90');
            Row({ space: 8 }) {
              this.ToneChoice('深色', TextTone.DARK);
              this.ToneChoice('浅色', TextTone.LIGHT);
            }
          }
          .width('100%')
          .margin({ top: 8 })
          .justifyContent(FlexAlign.SpaceBetween)
          .alignItems(VerticalAlign.Center);
        }
        .width('100%')
        .padding({ left: 18, right: 18, top: 14 });
      }
    }
    .width('100%')
    .height(this.themeMode === ThemeMode.CUSTOM ? 500 : 250)
    .backgroundColor('#F7F7F8')
    .borderRadius({ topLeft: 24, topRight: 24 });
  }

  @Builder
  ThemeChoice(title: string, subtitle: string, target: ThemeMode) {
    Column() {
      if (target === ThemeMode.CAT) {
        Image($r('app.media.hajimi_hero'))
          .width(38)
          .height(38)
          .objectFit(ImageFit.Contain);
      } else {
        Text(target === ThemeMode.MINIMAL ? 'Aa' : '▧')
          .fontSize(21)
          .fontWeight(FontWeight.Bold)
          .fontColor('#242428')
          .height(38);
      }
      Text(title)
        .fontSize(13)
        .fontWeight(this.themeMode === target ? FontWeight.Bold : FontWeight.Medium)
        .fontColor('#242428')
        .margin({ top: 4 });
      Text(subtitle)
        .fontSize(9)
        .fontColor('#8A8A90')
        .margin({ top: 2 });
    }
    .width('31%')
    .height(102)
    .justifyContent(FlexAlign.Center)
    .backgroundColor(this.themeMode === target ? '#E9F0FF' : '#FFFFFF')
    .borderRadius(14)
    .border({ width: this.themeMode === target ? 1 : 0, color: '#3478F6' })
    .hoverEffect(HoverEffect.Scale)
    .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.97 })
    .onClick(() => {
      this.themeMode = target;
      if (target === ThemeMode.CUSTOM && this.backgroundImageUri.length === 0) {
        this.noticeText = '请选择一张背景图片';
      }
    });
  }

  @Builder
  BlurChoice(text: string, target: BackgroundBlurLevel) {
    Button(text)
      .width('31%')
      .height(32)
      .fontSize(11)
      .fontColor(this.backgroundBlurLevel === target ? '#FFFFFF' : '#4A4A50')
      .backgroundColor(this.backgroundBlurLevel === target ? '#242428' : '#ECECEF')
      .borderRadius(10)
      .hoverEffect(HoverEffect.Scale)
      .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.97 })
      .onClick(() => {
        this.backgroundBlurLevel = target;
      });
  }

  @Builder
  OverlayChoice(text: string, target: BackgroundOverlayLevel) {
    Button(text)
      .width('31%')
      .height(32)
      .fontSize(11)
      .fontColor(this.backgroundOverlayLevel === target ? '#FFFFFF' : '#4A4A50')
      .backgroundColor(this.backgroundOverlayLevel === target ? '#242428' : '#ECECEF')
      .borderRadius(10)
      .hoverEffect(HoverEffect.Scale)
      .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.97 })
      .onClick(() => {
        this.backgroundOverlayLevel = target;
      });
  }

  @Builder
  ToneChoice(text: string, target: TextTone) {
    Button(text)
      .height(28)
      .fontSize(10)
      .fontColor(this.textTone === target ? '#FFFFFF' : '#4A4A50')
      .backgroundColor(this.textTone === target ? '#242428' : '#ECECEF')
      .borderRadius(9)
      .onClick(() => {
        this.textTone = target;
      });
  }

  @Builder
  RadixSheet() {
    Column() {
      this.SheetHeader('输入进制');
      Row() {
        this.RadixChoice('HEX', 16);
        this.RadixChoice('DEC', 10);
        this.RadixChoice('OCT', 8);
        this.RadixChoice('BIN', 2);
      }
      .width('100%')
      .padding({ left: 16, right: 16 })
      .justifyContent(FlexAlign.SpaceBetween);
    }
    .width('100%')
    .height(150)
    .backgroundColor('#F7F7F8')
    .borderRadius({ topLeft: 24, topRight: 24 });
  }

  @Builder
  RadixChoice(text: string, value: number) {
    Button(text)
      .width('23%')
      .height(40)
      .fontSize(12)
      .fontWeight(this.radix === value ? FontWeight.Bold : FontWeight.Medium)
      .fontColor(this.radix === value ? '#FFFFFF' : '#4A4A50')
      .backgroundColor(this.radix === value ? '#3478F6' : '#ECECEF')
      .borderRadius(11)
      .onClick(() => {
        this.switchRadix(value);
        this.overlayType = '';
      });
  }

  @Builder
  BitWidthSheet() {
    Column() {
      this.SheetHeader('整数位宽', '固定宽度无符号整数');
      Row() {
        this.BitChoice(8);
        this.BitChoice(16);
        this.BitChoice(32);
        this.BitChoice(64);
      }
      .width('100%')
      .padding({ left: 16, right: 16 })
      .justifyContent(FlexAlign.SpaceBetween);
    }
    .width('100%')
    .height(160)
    .backgroundColor('#F7F7F8')
    .borderRadius({ topLeft: 24, topRight: 24 });
  }

  @Builder
  BitChoice(value: number) {
    Button(value.toString())
      .width('23%')
      .height(40)
      .fontSize(12)
      .fontColor(this.bitWidth === value ? '#FFFFFF' : '#4A4A50')
      .backgroundColor(this.bitWidth === value ? '#242428' : '#ECECEF')
      .borderRadius(11)
      .onClick(() => {
        this.bitWidth = value;
        this.noticeText = value.toString() + ' bit';
        this.updateProgramPreview();
        this.overlayType = '';
      });
  }

  handleStandardKey(key: string): void {
    this.noticeText = '';
    if (key === '=') {
      this.finishNormalCalculation();
      return;
    }
    if (key === 'C') {
      this.setNormalEditResult(new EditResult('', 0, 0));
      return;
    }
    if (key === '⌫') {
      this.setNormalEditResult(ExpressionEditor.deleteBackward(
        this.normalExpression, this.normalSelectionStart, this.normalSelectionEnd));
      return;
    }
    if (key === '±') {
      this.insertNormalSign();
      return;
    }
    this.setNormalEditResult(ExpressionEditor.insert(
      this.normalExpression, this.normalSelectionStart, this.normalSelectionEnd, key));
  }

  handleScientificKey(key: string): void {
    this.noticeText = '';
    if (key === 'sin' || key === 'cos' || key === 'tan' || key === 'log' || key === 'ln') {
      this.wrapNormalFunction(key);
    } else if (key === '√') {
      this.wrapNormalCustom('√(', ')');
    } else if (key === 'π' || key === 'e' || key === '(' || key === ')' || key === '%' || key === '^') {
      this.setNormalEditResult(ExpressionEditor.insert(
        this.normalExpression, this.normalSelectionStart, this.normalSelectionEnd, key));
    } else if (key === 'x²') {
      this.insertSquare();
    } else if (key === 'xʸ') {
      this.setNormalEditResult(ExpressionEditor.insert(
        this.normalExpression, this.normalSelectionStart, this.normalSelectionEnd, '^'));
    } else if (key === '1/x') {
      this.wrapNormalCustom('1/(', ')');
    } else if (key === '|x|') {
      this.wrapNormalCustom('abs(', ')');
    } else if (key === '±') {
      this.insertNormalSign();
    }
  }

  handleProgramKey(key: string): void {
    this.noticeText = '';
    if (key === '=') {
      this.finishProgramCalculation();
      return;
    }
    if (key === 'AC') {
      this.setProgramEditResult(new EditResult('', 0, 0));
      return;
    }
    if (key === '⌫') {
      this.setProgramEditResult(ExpressionEditor.deleteBackward(
        this.programExpression, this.programSelectionStart, this.programSelectionEnd));
      return;
    }
    if (key === 'NOT') {
      let s = ExpressionEditor.normalizedStart(this.programExpression, this.programSelectionStart, this.programSelectionEnd);
      let e = ExpressionEditor.normalizedEnd(this.programExpression, this.programSelectionStart, this.programSelectionEnd);
      if (s !== e) {
        this.setProgramEditResult(ExpressionEditor.wrap(this.programExpression, s, e, 'NOT (', ')', false));
      } else {
        this.setProgramEditResult(ExpressionEditor.insert(this.programExpression, s, e, 'NOT '));
      }
      return;
    }
    if (key === 'AND' || key === 'OR' || key === 'XOR' || key === 'MOD' || key === '<<' || key === '>>') {
      this.setProgramEditResult(ExpressionEditor.insert(
        this.programExpression, this.programSelectionStart, this.programSelectionEnd, ' ' + key + ' '));
      return;
    }
    this.setProgramEditResult(ExpressionEditor.insert(
      this.programExpression, this.programSelectionStart, this.programSelectionEnd, key));
  }

  setNormalEditResult(edit: EditResult): void {
    this.normalExpression = edit.text;
    this.normalSelectionStart = edit.selectionStart;
    this.normalSelectionEnd = edit.selectionEnd;
    this.updateNormalPreview();
    this.restoreNormalCaret(edit.selectionStart);
  }

  setProgramEditResult(edit: EditResult): void {
    this.programExpression = edit.text.toUpperCase();
    this.programSelectionStart = edit.selectionStart;
    this.programSelectionEnd = edit.selectionEnd;
    this.updateProgramPreview();
    this.restoreProgramCaret(edit.selectionStart);
  }

  insertNormalSign(): void {
    this.setNormalEditResult(ExpressionEditor.toggleSign(
      this.normalExpression, this.normalSelectionStart, this.normalSelectionEnd));
  }

  wrapNormalFunction(name: string): void {
    this.setNormalEditResult(ExpressionEditor.wrap(
      this.normalExpression,
      this.normalSelectionStart,
      this.normalSelectionEnd,
      name + '(',
      ')',
      true
    ));
  }

  wrapNormalCustom(prefix: string, suffix: string): void {
    this.setNormalEditResult(ExpressionEditor.wrap(
      this.normalExpression,
      this.normalSelectionStart,
      this.normalSelectionEnd,
      prefix,
      suffix,
      true
    ));
  }

  insertSquare(): void {
    let s = ExpressionEditor.normalizedStart(this.normalExpression, this.normalSelectionStart, this.normalSelectionEnd);
    let e = ExpressionEditor.normalizedEnd(this.normalExpression, this.normalSelectionStart, this.normalSelectionEnd);
    if (s !== e) {
      this.setNormalEditResult(ExpressionEditor.wrap(this.normalExpression, s, e, '(', ')^2', false));
    } else {
      this.setNormalEditResult(ExpressionEditor.insert(this.normalExpression, s, e, '^2'));
    }
  }

  finishNormalCalculation(): void {
    if (this.normalExpression.length === 0) {
      return;
    }
    let evaluated = ExpressionEngine.evaluate(this.normalExpression, this.precisionMode, this.angleMode);
    if (!evaluated.ok) {
      this.normalResult = 'NaN';
      this.normalErrorText = evaluated.error === EvalError.INCOMPLETE ? '' :
        (evaluated.errorText.length > 0 ? evaluated.errorText : '无法计算');
      return;
    }
    this.normalResult = NumberFormatter.normalizeForStorage(evaluated.valueText);
    this.normalErrorText = '';
    this.noticeText = '已计算';
    this.addHistory(this.normalExpression, this.normalResult, this.mode);
  }

  finishProgramCalculation(): void {
    if (this.programExpression.length === 0) {
      return;
    }
    let evaluated = ProgrammerEngine.evaluate(this.programExpression, this.radix, this.bitWidth);
    if (!evaluated.ok) {
      this.programResult = 'NaN';
      this.programErrorText = evaluated.error === EvalError.INCOMPLETE ? '' :
        (evaluated.errorText.length > 0 ? evaluated.errorText : '无法计算');
      return;
    }
    this.programResult = ProgrammerEngine.format(evaluated.value, this.radix);
    this.programErrorText = '';
    this.noticeText = '已计算';
    this.addHistory(this.programExpression, this.programResult, CalculatorMode.PROGRAMMER);
  }

  updateNormalPreview(): void {
    if (this.normalExpression.length === 0) {
      this.normalResult = '0';
      this.normalErrorText = '';
      return;
    }
    let evaluated = ExpressionEngine.evaluate(this.normalExpression, this.precisionMode, this.angleMode);
    if (evaluated.ok) {
      this.normalResult = NumberFormatter.normalizeForStorage(evaluated.valueText);
      this.normalErrorText = '';
    } else {
      this.normalResult = 'NaN';
      this.normalErrorText = evaluated.error === EvalError.INCOMPLETE ? '' : evaluated.errorText;
    }
  }

  updateProgramPreview(): void {
    if (this.programExpression.length === 0) {
      this.programResult = '0';
      this.programErrorText = '';
      return;
    }
    let evaluated = ProgrammerEngine.evaluate(this.programExpression, this.radix, this.bitWidth);
    if (evaluated.ok) {
      this.programResult = ProgrammerEngine.format(evaluated.value, this.radix);
      this.programErrorText = '';
    } else {
      this.programResult = 'NaN';
      this.programErrorText = evaluated.error === EvalError.INCOMPLETE ? '' : evaluated.errorText;
    }
  }

  private restoreNormalCaret(position: number): void {
    let target = ExpressionEditor.clampPosition(this.normalExpression, position);
    this.normalSelectionStart = target;
    this.normalSelectionEnd = target;
    setTimeout(() => {
      this.normalInputController.caretPosition(target);
    }, 0);
  }

  private restoreProgramCaret(position: number): void {
    let target = ExpressionEditor.clampPosition(this.programExpression, position);
    this.programSelectionStart = target;
    this.programSelectionEnd = target;
    setTimeout(() => {
      this.programInputController.caretPosition(target);
    }, 0);
  }

  switchMode(targetMode: CalculatorMode): void {
    if (targetMode === this.mode) {
      return;
    }
    this.mode = targetMode;
    this.overlayType = '';
    this.noticeText = '';
    if (targetMode === CalculatorMode.PROGRAMMER) {
      this.updateProgramPreview();
      this.restoreProgramCaret(this.programSelectionStart);
    } else {
      this.updateNormalPreview();
      this.restoreNormalCaret(this.normalSelectionStart);
    }
  }

  switchRadix(targetRadix: number): void {
    if (targetRadix === this.radix) {
      return;
    }
    let oldRadix = this.radix;
    if (this.programExpression.length > 0) {
      let evaluated = ProgrammerEngine.evaluate(this.programExpression, oldRadix, this.bitWidth);
      if (evaluated.ok) {
        this.radix = targetRadix;
        this.programExpression = ProgrammerEngine.format(evaluated.value, targetRadix);
        this.programSelectionStart = this.programExpression.length;
        this.programSelectionEnd = this.programExpression.length;
        this.updateProgramPreview();
        this.restoreProgramCaret(this.programExpression.length);
        this.noticeText = '已换算为 ' + this.radixLabel(targetRadix);
        return;
      }
    }
    this.radix = targetRadix;
    this.updateProgramPreview();
    this.noticeText = '已切换 ' + this.radixLabel(targetRadix);
  }

  addHistory(expression: string, resultText: string, historyMode: CalculatorMode): void {
    let item = new HistoryItem(
      Date.now().toString() + '_' + this.historyItems.length.toString(),
      historyMode,
      expression,
      resultText,
      this.precisionMode,
      this.angleMode,
      this.radix,
      this.bitWidth,
      Date.now()
    );
    let updated: Array<HistoryItem> = [item];
    for (let i = 0; i < this.historyItems.length && updated.length < this.maxHistoryCount; i++) {
      updated.push(this.historyItems[i]);
    }
    this.historyItems = updated;
    // Disk I/O happens only after a committed '=' calculation, never on key presses.
    this.service.saveHistory(this.historyItems);
  }

  restoreHistory(item: HistoryItem): void {
    this.precisionMode = item.precisionMode;
    this.angleMode = item.angleMode;
    this.radix = item.radix;
    this.bitWidth = item.bitWidth;
    if (item.mode === CalculatorMode.PROGRAMMER) {
      this.programExpression = item.expression;
      this.programSelectionStart = item.expression.length;
      this.programSelectionEnd = item.expression.length;
      this.mode = CalculatorMode.PROGRAMMER;
      this.updateProgramPreview();
      this.programInputController.caretPosition(this.programExpression.length);
    } else {
      this.normalExpression = item.expression;
      this.normalSelectionStart = item.expression.length;
      this.normalSelectionEnd = item.expression.length;
      this.mode = item.mode;
      this.updateNormalPreview();
      this.normalInputController.caretPosition(this.normalExpression.length);
    }
    this.overlayType = '';
    this.noticeText = '已恢复';
  }

  copyResult(): void {
    let text = this.mode === CalculatorMode.PROGRAMMER ? this.programResult : this.normalResult;
    this.service.copyText(text).then((success: boolean) => {
      this.noticeText = success ? '已复制' : '复制失败';
    });
  }

  canCopyResult(): boolean {
    let text = this.mode === CalculatorMode.PROGRAMMER ? this.programResult : this.normalResult;
    return text.length > 0 && text !== 'NaN';
  }

  updateProgramConversions(value: bigint): void {
    this.programHex = ProgrammerEngine.format(value, 16);
    this.programDec = ProgrammerEngine.format(value, 10);
    this.programOct = ProgrammerEngine.format(value, 8);
    this.programBin = ProgrammerEngine.formatBinaryGrouped(value, this.bitWidth);
  }

  resetProgramConversions(): void {
    this.programHex = '0';
    this.programDec = '0';
    this.programOct = '0';
    this.programBin = '0';
  }

  isProgramKeyEnabled(key: string): boolean {
    if (key.length === 1) {
      let digit = ProgrammerEngine.digitValue(key);
      if (digit >= 0) {
        return digit < this.radix;
      }
    }
    return true;
  }

  async selectCustomBackground(): Promise<void> {
    let uri = await this.service.pickAndStoreBackground();
    if (uri.length > 0) {
      this.backgroundImageUri = uri;
      this.themeMode = ThemeMode.CUSTOM;
      this.noticeText = '背景已更新';
      this.saveUiSettings();
    } else {
      this.noticeText = '未选择图片';
    }
  }

  closeOverlay(saveSettings: boolean): void {
    if (saveSettings && (this.overlayType === 'appearance' || this.overlayType === 'settings')) {
      this.saveUiSettings();
    }
    this.overlayType = '';
  }

  saveUiSettings(): void {
    this.service.saveUiSettings(new UiSettings(
      this.themeMode,
      this.backgroundImageUri,
      this.backgroundBlurLevel,
      this.backgroundOverlayLevel,
      this.buttonOpacity,
      this.textTone
    ));
  }

  normalExpressionFontSize(): number {
    if (this.normalExpression.length > 28) {
      return 20;
    }
    if (this.normalExpression.length > 20) {
      return 24;
    }
    return 30;
  }

  normalDisplayText(): string {
    if (this.normalResult === 'NaN') {
      return 'NaN';
    }
    return NumberFormatter.formatForDisplay(this.normalResult, 12);
  }

  normalResultFontSize(): number {
    let text = this.normalDisplayText();
    if (text.length > 17) {
      return 32;
    }
    if (text.length > 13) {
      return 37;
    }
    return 44;
  }

  normalEnvironmentLabel(): string {
    if (this.mode === CalculatorMode.SCIENTIFIC) {
      return (this.angleMode === AngleMode.DEG ? 'DEG' : 'RAD') + ' · ' +
        (this.precisionMode === PrecisionMode.HIGH ? 'Decimal 基础运算' : 'Number');
    }
    return this.precisionMode === PrecisionMode.HIGH ? 'Decimal 高精度' : 'Number 标准精度';
  }

  historyModeLabel(item: HistoryItem): string {
    if (item.mode === CalculatorMode.SCIENTIFIC) {
      return '科学';
    }
    if (item.mode === CalculatorMode.PROGRAMMER) {
      return '程序员';
    }
    return '标准';
  }

  historyEnvironmentLabel(item: HistoryItem): string {
    if (item.mode === CalculatorMode.PROGRAMMER) {
      return this.radixLabel(item.radix) + ' · ' + item.bitWidth.toString() + ' bit';
    }
    if (item.mode === CalculatorMode.SCIENTIFIC) {
      return (item.angleMode === AngleMode.DEG ? 'DEG' : 'RAD') + ' · ' +
        (item.precisionMode === PrecisionMode.HIGH ? '高精度' : '标准');
    }
    return item.precisionMode === PrecisionMode.HIGH ? '高精度' : '标准精度';
  }

  radixLabel(value: number): string {
    if (value === 16) {
      return 'HEX';
    }
    if (value === 8) {
      return 'OCT';
    }
    if (value === 2) {
      return 'BIN';
    }
    return 'DEC';
  }

  // ---------------- Theme helpers ----------------

  pageBackgroundColor(): string {
    if (this.themeMode === ThemeMode.CAT) {
      return '#FBF8F2';
    }
    if (this.themeMode === ThemeMode.CUSTOM) {
      return '#121214';
    }
    return '#F7F7F8';
  }

  primaryTextColor(): string {
    if (this.themeMode === ThemeMode.CAT) {
      return '#242220';
    }
    if (this.themeMode === ThemeMode.CUSTOM && this.textTone === TextTone.LIGHT) {
      return '#FFFFFF';
    }
    return '#171719';
  }

  expressionTextColor(): string {
    if (this.themeMode === ThemeMode.CUSTOM && this.textTone === TextTone.LIGHT) {
      return '#E8E8EC';
    }
    if (this.themeMode === ThemeMode.CAT) {
      return '#625B55';
    }
    return '#606066';
  }

  secondaryTextColor(): string {
    if (this.themeMode === ThemeMode.CUSTOM && this.textTone === TextTone.LIGHT) {
      return '#D0D0D6';
    }
    if (this.themeMode === ThemeMode.CAT) {
      return '#918980';
    }
    return '#8A8A90';
  }

  accentColor(): string {
    if (this.themeMode === ThemeMode.CAT) {
      return '#DB7445';
    }
    return '#3478F6';
  }

  errorColor(): string {
    return '#C53A3A';
  }

  activeTabBackground(): string {
    if (this.themeMode === ThemeMode.CAT) {
      return '#DB7445';
    }
    if (this.themeMode === ThemeMode.CUSTOM && this.textTone === TextTone.LIGHT) {
      return 'rgba(255,255,255,0.92)';
    }
    return '#242428';
  }

  activeTabTextColor(): string {
    if (this.themeMode === ThemeMode.CUSTOM && this.textTone === TextTone.LIGHT) {
      return '#171719';
    }
    return '#FFFFFF';
  }

  inactiveTabBackground(): string {
    if (this.themeMode === ThemeMode.CAT) {
      return '#EFE9E1';
    }
    if (this.themeMode === ThemeMode.CUSTOM) {
      return this.customWhiteAlpha(this.buttonOpacity * 0.72);
    }
    return '#ECECEF';
  }

  panelBackgroundColor(): string {
    if (this.themeMode === ThemeMode.CAT) {
      return '#FDFCF9';
    }
    if (this.themeMode === ThemeMode.CUSTOM) {
      return this.customWhiteAlpha(Math.min(0.94, this.buttonOpacity + 0.06));
    }
    return '#FFFFFF';
  }

  keyboardBackgroundColor(): string {
    if (this.themeMode === ThemeMode.CAT) {
      return '#F3EEE7';
    }
    if (this.themeMode === ThemeMode.CUSTOM) {
      return 'rgba(255,255,255,0.10)';
    }
    return '#F1F1F3';
  }

  utilityButtonBackground(): string {
    if (this.themeMode === ThemeMode.CAT) {
      return '#EFE9E1';
    }
    if (this.themeMode === ThemeMode.CUSTOM) {
      return this.customWhiteAlpha(this.buttonOpacity * 0.75);
    }
    return '#ECECEF';
  }

  scientificKeyBackground(): string {
    if (this.themeMode === ThemeMode.CAT) {
      return '#F4E5DC';
    }
    if (this.themeMode === ThemeMode.CUSTOM) {
      return this.customWhiteAlpha(this.buttonOpacity);
    }
    return '#E9E9ED';
  }

  standardKeyBackground(key: string): string {
    if (key === '=') {
      if (this.themeMode === ThemeMode.CAT) {
        return '#DB7445';
      }
      if (this.themeMode === ThemeMode.CUSTOM) {
        return 'rgba(28,28,32,0.92)';
      }
      return '#242428';
    }
    if (key === '÷' || key === '×' || key === '-' || key === '+' || key === '%' || key === '±') {
      if (this.themeMode === ThemeMode.CAT) {
        return '#F4E1D5';
      }
      if (this.themeMode === ThemeMode.CUSTOM) {
        return this.customBlueAlpha(this.buttonOpacity);
      }
      return '#E9F0FF';
    }
    if (key === 'C' || key === '⌫') {
      if (this.themeMode === ThemeMode.CAT) {
        return '#EFE9E1';
      }
      if (this.themeMode === ThemeMode.CUSTOM) {
        return this.customWhiteAlpha(this.buttonOpacity * 0.90);
      }
      return '#E9E9ED';
    }
    if (this.themeMode === ThemeMode.CUSTOM) {
      return this.customWhiteAlpha(this.buttonOpacity);
    }
    return '#FFFFFF';
  }

  standardKeyTextColor(key: string): string {
    if (key === '=') {
      return '#FFFFFF';
    }
    if (key === '÷' || key === '×' || key === '-' || key === '+' || key === '%' || key === '±') {
      return this.accentColor();
    }
    if (key === 'C') {
      return '#C53A3A';
    }
    if (this.themeMode === ThemeMode.CUSTOM && this.textTone === TextTone.LIGHT) {
      return '#171719';
    }
    return this.primaryTextColor();
  }

  programKeyBackground(key: string): string {
    if (key === '=') {
      return this.standardKeyBackground('=');
    }
    if (key === 'AND' || key === 'OR' || key === 'XOR' || key === 'NOT' || key === 'MOD' || key === '<<' || key === '>>' ||
      key === '÷' || key === '×' || key === '-' || key === '+') {
      if (this.themeMode === ThemeMode.CAT) {
        return '#F4E1D5';
      }
      if (this.themeMode === ThemeMode.CUSTOM) {
        return this.customBlueAlpha(this.buttonOpacity);
      }
      return '#E9F0FF';
    }
    if (key === 'AC' || key === '⌫') {
      return this.utilityButtonBackground();
    }
    if (this.themeMode === ThemeMode.CUSTOM) {
      return this.customWhiteAlpha(this.buttonOpacity);
    }
    return '#FFFFFF';
  }

  programKeyTextColor(key: string): string {
    if (key === '=') {
      return '#FFFFFF';
    }
    if (key === 'AND' || key === 'OR' || key === 'XOR' || key === 'NOT' || key === 'MOD' || key === '<<' || key === '>>' ||
      key === '÷' || key === '×' || key === '-' || key === '+') {
      return this.accentColor();
    }
    if (key === 'AC') {
      return '#C53A3A';
    }
    if (this.themeMode === ThemeMode.CUSTOM && this.textTone === TextTone.LIGHT) {
      return '#171719';
    }
    return this.primaryTextColor();
  }

  panelShadowColor(): string {
    if (this.themeMode === ThemeMode.CUSTOM) {
      return '#26000000';
    }
    return '#10000000';
  }

  keyShadowColor(): string {
    if (this.themeMode === ThemeMode.CAT) {
      return '#18A96B45';
    }
    return '#12000000';
  }

  backgroundBlurRadius(): number {
    if (this.backgroundBlurLevel === BackgroundBlurLevel.BLUR) {
      return 12;
    }
    if (this.backgroundBlurLevel === BackgroundBlurLevel.SOFT) {
      return 6;
    }
    return 0;
  }

  backgroundOverlayColor(): string {
    let alpha = 0;
    if (this.backgroundOverlayLevel === BackgroundOverlayLevel.LIGHT) {
      alpha = 0.18;
    } else if (this.backgroundOverlayLevel === BackgroundOverlayLevel.MEDIUM) {
      alpha = 0.34;
    }
    if (this.textTone === TextTone.LIGHT) {
      return 'rgba(0,0,0,' + alpha.toString() + ')';
    }
    return 'rgba(255,255,255,' + alpha.toString() + ')';
  }

  customWhiteAlpha(alpha: number): string {
    return 'rgba(255,255,255,' + Math.max(0, Math.min(alpha, 1)).toString() + ')';
  }

  customBlueAlpha(alpha: number): string {
    let a = Math.max(0, Math.min(alpha, 1));
    return 'rgba(225,236,255,' + a.toString() + ')';
  }
}
