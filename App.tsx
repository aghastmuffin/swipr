import { StatusBar } from 'expo-status-bar';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { useFonts } from 'expo-font';
import { Archive, Images, SlidersHorizontal } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DeleteScreen } from './src/DeleteScreen';
import { LibraryScreen } from './src/LibraryScreen';
import { ReviewScreen } from './src/ReviewScreen';
import { SettingsScreen } from './src/SettingsScreen';
import { PhotoStoreProvider, usePhotoStore } from './src/store';
import { colors, shadow, type } from './src/theme';
import { ReviewMode, RootScreen } from './src/types';

function AppShell() {
  const [screen, setScreen] = useState<RootScreen>({ name: 'library' });
  const { decisions } = usePhotoStore();
  const queueCount = Object.values(decisions).filter(
    (decision) => decision.decision === 'delete',
  ).length;

  const openReview = (monthKey: string, mode: ReviewMode) =>
    setScreen({ name: 'review', monthKey, mode });

  if (screen.name === 'review') {
    return (
      <SafeAreaView style={styles.safe}>
        <ReviewScreen
          monthKey={screen.monthKey}
          mode={screen.mode}
          onClose={() => setScreen({ name: 'library' })}
          onOpenDelete={() => setScreen({ name: 'delete' })}
        />
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        {screen.name === 'library' && <LibraryScreen onReview={openReview} />}
        {screen.name === 'delete' && <DeleteScreen />}
        {screen.name === 'settings' && <SettingsScreen />}
      </View>
      <View style={styles.tabBar}>
        <TabButton
          label="Archive"
          active={screen.name === 'library'}
          onPress={() => setScreen({ name: 'library' })}
          icon={<Images size={21} />}
        />
        <TabButton
          label="Delete"
          active={screen.name === 'delete'}
          onPress={() => setScreen({ name: 'delete' })}
          icon={<Archive size={21} />}
          badge={queueCount}
        />
        <TabButton
          label="Desk"
          active={screen.name === 'settings'}
          onPress={() => setScreen({ name: 'settings' })}
          icon={<SlidersHorizontal size={21} />}
        />
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
  icon,
  badge,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: React.ReactElement<{ color?: string; strokeWidth?: number }>;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
    >
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        {React.cloneElement(icon, {
          color: active ? colors.white : colors.inkSoft,
          strokeWidth: active ? 2.5 : 2,
        })}
        {!!badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    DMSerifDisplay: DMSerifDisplay_400Regular,
    DMSans: DMSans_400Regular,
    DMSansMedium: DMSans_500Medium,
    DMSansBold: DMSans_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={styles.root} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <PhotoStoreProvider>
        <AppShell />
      </PhotoStoreProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    position: 'absolute',
    left: 13,
    right: 13,
    bottom: Platform.OS === 'ios' ? 5 : 10,
    minHeight: 70,
    backgroundColor: colors.paperRaised,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadow,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabPressed: {
    opacity: 0.65,
  },
  iconWrap: {
    width: 38,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.orange,
  },
  tabLabel: {
    color: colors.inkSoft,
    fontFamily: type.mono,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: colors.orange,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.paperRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontFamily: type.sans,
    fontSize: 8,
    fontWeight: '800',
  },
});
