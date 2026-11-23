import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StateView } from '@/components/ui/StateView';
import { colors, fonts } from '@/theme/theme';

export default function RadioScreen() {
  return (
    <Screen>
      <View>
        <SectionHeader title="Live-Radio" right={<Text style={styles.sub}>40.000+ Sender</Text>} />
        <StateView
          kind="empty"
          icon="📻"
          title="Radio folgt im nächsten Ausbauschritt"
          message="Diese Testversion enthält noch keine Sender. Sobald Radio Browser angebunden ist, erscheinen hier die Live-Sender."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { color: colors.textMuted, fontSize: fonts.size.caption },
});
