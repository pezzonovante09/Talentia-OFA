import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from './Text';
import { Button } from './Button';
import { useAppTheme } from '../theme';
import { captureException } from '../services/sentry';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    captureException(error, { componentStack: errorInfo.componentStack ?? undefined });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ hasError: false, error: null })} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.xl,
        backgroundColor: theme.colors.background,
      }}
    >
      <AppText variant="title" style={{ color: theme.colors.error, marginBottom: theme.spacing.md, textAlign: 'center' }}>
        {t('errorBoundary.title')}
      </AppText>
      <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing.lg }}>
        {error.message}
      </AppText>
      <Button onPress={onRetry}>{t('errorBoundary.tryAgain')}</Button>
    </View>
  );
}
