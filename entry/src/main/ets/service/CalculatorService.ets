import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { pasteboard } from '@kit.BasicServicesKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { fileIo, fileUri } from '@kit.CoreFileKit';
import {
  AngleMode,
  BackgroundBlurLevel,
  BackgroundOverlayLevel,
  CalculatorMode,
  HistoryItem,
  HistoryRaw,
  PrecisionMode,
  TextTone,
  ThemeMode,
  UiSettings,
  UiSettingsRaw
} from '../model/CalculatorTypes';

export default class CalculatorService {
  private static readonly PREF_NAME: string = 'calculator_core_v1_1';
  private static readonly HISTORY_KEY: string = 'history_json';
  private static readonly UI_SETTINGS_KEY: string = 'ui_settings_json';
  private prefs: preferences.Preferences | null = null;
  private context: common.Context | null = null;

  init(context: common.Context): void {
    this.context = context;
    try {
      this.prefs = preferences.getPreferencesSync(context, { name: CalculatorService.PREF_NAME });
    } catch (error) {
      this.prefs = null;
    }
  }

  loadHistory(): Array<HistoryItem> {
    let result: Array<HistoryItem> = [];
    if (this.prefs === null) {
      return result;
    }
    try {
      let rawValue = this.prefs.getSync(CalculatorService.HISTORY_KEY, '');
      let raw = rawValue as string;
      if (raw.length === 0) {
        return result;
      }
      let parsed = JSON.parse(raw) as Array<HistoryRaw>;
      parsed.forEach((item: HistoryRaw) => {
        result.push(new HistoryItem(
          item.id,
          item.mode as CalculatorMode,
          item.expression,
          item.result,
          item.precisionMode as PrecisionMode,
          item.angleMode as AngleMode,
          item.radix,
          item.bitWidth,
          item.createdAt
        ));
      });
    } catch (error) {
      return [];
    }
    return result;
  }

  saveHistory(items: Array<HistoryItem>): void {
    if (this.prefs === null) {
      return;
    }
    try {
      this.prefs.putSync(CalculatorService.HISTORY_KEY, JSON.stringify(items));
      this.prefs.flushSync();
    } catch (error) {
      // Persistence failure must never block calculation.
    }
  }

  loadUiSettings(): UiSettings {
    let fallback = new UiSettings(
      ThemeMode.MINIMAL,
      '',
      BackgroundBlurLevel.SOFT,
      BackgroundOverlayLevel.LIGHT,
      0.84,
      TextTone.DARK
    );
    if (this.prefs === null) {
      return fallback;
    }
    try {
      let rawValue = this.prefs.getSync(CalculatorService.UI_SETTINGS_KEY, '');
      let raw = rawValue as string;
      if (raw.length === 0) {
        return fallback;
      }
      let parsed = JSON.parse(raw) as UiSettingsRaw;
      let opacity = parsed.buttonOpacity;
      if (opacity < 0.60 || opacity > 1.0) {
        opacity = 0.84;
      }
      return new UiSettings(
        parsed.themeMode as ThemeMode,
        parsed.backgroundImageUri,
        parsed.backgroundBlurLevel as BackgroundBlurLevel,
        parsed.backgroundOverlayLevel as BackgroundOverlayLevel,
        opacity,
        parsed.textTone as TextTone
      );
    } catch (error) {
      return fallback;
    }
  }

  saveUiSettings(settings: UiSettings): void {
    if (this.prefs === null) {
      return;
    }
    try {
      this.prefs.putSync(CalculatorService.UI_SETTINGS_KEY, JSON.stringify(settings));
      this.prefs.flushSync();
    } catch (error) {
      // Visual settings persistence failure must not block the calculator.
    }
  }

  async pickAndStoreBackground(): Promise<string> {
    if (this.context === null) {
      return '';
    }
    try {
      let options = new photoAccessHelper.PhotoSelectOptions();
      options.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
      options.maxSelectNumber = 1;
      options.isPhotoTakingSupported = false;
      let picker = new photoAccessHelper.PhotoViewPicker();
      let result = await picker.select(options);
      if (result.photoUris.length === 0) {
        return '';
      }
      let sourceUri = result.photoUris[0];
      let extension = this.resolveImageExtension(sourceUri);
      let targetPath = this.context.filesDir + '/calculator_custom_background_' + Date.now().toString() + extension;
      let sourceFile = fileIo.openSync(sourceUri, fileIo.OpenMode.READ_ONLY);
      let targetFile = fileIo.openSync(targetPath, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE);
      fileIo.copyFileSync(sourceFile.fd, targetFile.fd);
      fileIo.closeSync(sourceFile);
      fileIo.closeSync(targetFile);
      return fileUri.getUriFromPath(targetPath).toString();
    } catch (error) {
      return '';
    }
  }

  private resolveImageExtension(uri: string): string {
    let lower = uri.toLowerCase();
    if (lower.endsWith('.png')) {
      return '.png';
    }
    if (lower.endsWith('.webp')) {
      return '.webp';
    }
    if (lower.endsWith('.jpeg')) {
      return '.jpeg';
    }
    return '.jpg';
  }

  async copyText(text: string): Promise<boolean> {
    if (text.length === 0 || text === 'NaN') {
      return false;
    }
    try {
      let data = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, text);
      await pasteboard.getSystemPasteboard().setData(data);
      return true;
    } catch (error) {
      return false;
    }
  }
}
