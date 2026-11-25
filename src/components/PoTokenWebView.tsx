import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { handlePoTokenMessage, PO_TOKEN_HTML, registerPoTokenWebView } from '@/services/youtube/poToken';

const WEBVIEW_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Unsichtbare WebView für die PO-Token-Erzeugung (BotGuard braucht eine Browser-Umgebung). */
export function PoTokenWebView() {
  const ref = useRef<WebView<object>>(null);
  useEffect(() => () => registerPoTokenWebView(null), []);

  return (
    <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView<object>
        ref={ref}
        // Ursprung youtube.com: BotGuard und GenerateIT erwarten ihn.
        source={{ html: PO_TOKEN_HTML, baseUrl: 'https://www.youtube.com/' }}
        originWhitelist={['*']}
        // Wie NewPipe (PoTokenWebView.kt): Desktop-Chrome statt WebView-Kennung „; wv“ –
        // mit Standard-UA erzeugte Tokens lehnt YouTube ab (Handytest 25.11.2026: 403, derselbe Ablauf in jsdom: 206).
        userAgent={WEBVIEW_USER_AGENT}
        onLoadEnd={() => registerPoTokenWebView((js) => ref.current?.injectJavaScript(js))}
        onMessage={(e) => handlePoTokenMessage(e.nativeEvent.data)}
        onContentProcessDidTerminate={() => registerPoTokenWebView(null)}
        onRenderProcessGone={() => registerPoTokenWebView(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
});
