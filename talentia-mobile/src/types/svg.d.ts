/**
 * SVG импортируются как компоненты: `import Tali from '.../tali-hello.svg'`.
 * Преобразование делает react-native-svg-transformer, настроенный в
 * metro.config.js.
 */
declare module '*.svg' {
  import type * as React from 'react';
  import type { SvgProps } from 'react-native-svg';

  const content: React.FC<SvgProps>;
  export default content;
}
