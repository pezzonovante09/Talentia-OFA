/** SHA-256 для хеша PIN (`domain/parentGate.ts`, `Digest`) — `expo-crypto`, в тестах мок на `node:crypto`. */
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import type { Digest } from '../domain/parentGate';

export const sha256: Digest = (input) => digestStringAsync(CryptoDigestAlgorithm.SHA256, input);
