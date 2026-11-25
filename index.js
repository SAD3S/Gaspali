// Point d'entrée : Expo Router, plus la tâche de fond qui dessine les widgets Android.
import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widgets/taskHandler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
