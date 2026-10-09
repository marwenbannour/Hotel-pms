import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import { WebView as RNWebView } from 'react-native-webview';
import type { AndroidWebViewProps, IOSWebViewProps } from 'react-native-webview/lib/WebViewTypes';

/** Méthodes de la WebView utilisées par l'application. */
export interface WebViewHandle {
  goBack: () => void;
  reload: () => void;
}

/**
 * react-native-webview 14 type son export commun avec l'intersection des props de toutes les
 * plateformes (Windows compris), qui se réduit à `never`, et sans type de ref. Chaque plateforme
 * exporte en réalité un forwardRef : on le décrit pour Android et iOS.
 */
export const WebView = RNWebView as unknown as ForwardRefExoticComponent<AndroidWebViewProps & IOSWebViewProps & RefAttributes<WebViewHandle>>;
