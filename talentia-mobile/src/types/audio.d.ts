/** Аудиофайл из сборки: Metro отдаёт номер ассета, его принимает `expo-audio` (`src/services/soundFiles.ts`). */
declare module '*.m4a' {
  const asset: number;
  export default asset;
}
declare module '*.mp3' {
  const asset: number;
  export default asset;
}
declare module '*.wav' {
  const asset: number;
  export default asset;
}
