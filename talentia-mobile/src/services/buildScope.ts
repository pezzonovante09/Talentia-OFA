/**
 * Флаг сборки первой версии (№195): `EXPO_PUBLIC_BUILD_SCOPE=aba` в профиле `preview` (`eas.json`) — только ABA «Со
 * взрослым». Скрывает вход в обычный режим и режим «Сам»; код режимов не удаляется. Metro подставляет `EXPO_PUBLIC_*`
 * при сборке, поэтому обращение — только целиком `process.env.EXPO_PUBLIC_BUILD_SCOPE`.
 */
export const ABA_ONLY: boolean = process.env.EXPO_PUBLIC_BUILD_SCOPE === 'aba';
