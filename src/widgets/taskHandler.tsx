import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { renderGaspalliWidget } from './GaspalliWidgets';
import { parseSnapshot, WIDGET_SNAPSHOT_KEY } from './snapshot';

/** Appelé par Android (même app fermée) quand un widget est posé, redimensionné ou rafraîchi. */
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  const snapshot = parseSnapshot(await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY).catch(() => null));
  renderWidget(renderGaspalliWidget(widgetInfo.widgetName, snapshot));
}
