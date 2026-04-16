import { StatusBar } from 'expo-status-bar'
import { View, StyleSheet } from 'react-native'
import { colors } from '../src/styles/colors'
import { typography } from '../src/styles/typographys'
import { spacing } from '../src/styles/spacing'
import RootNavigator from '../src/navigation/RootNavigator'

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <RootNavigator />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    primaryColor: colors.primary,
    textColor: colors.text,
    textSecondaryColor: colors.textSecondary,
    borderColor: colors.border,
    errorColor: colors.error,
    successColor: colors.success,
    h1Typography: typography.h1, 
    h2Typography: typography.h2, 
    bodyTypography: typography.body, 
    captionTypography: typography.caption,
    xsSpacing: spacing.xs, 
    smSpacing: spacing.sm, 
    mdSpacing: spacing.md, 
    lgSpacing: spacing.lg, 
    xlSpacing: spacing.xl, 
    xxlSpacing: spacing.xxl, 
  },
})