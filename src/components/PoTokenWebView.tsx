import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { handlePoTokenMessage, PO_TOKEN_HTML, registerPoTokenWebView } from '@/services/youtube/poToken';

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
