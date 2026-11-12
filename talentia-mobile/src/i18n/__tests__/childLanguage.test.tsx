/**
 * Язык профиля ребёнка и язык взрослого (№190, `localization-qa`): детские экраны — на языке профиля, пока идёт сессия
 * ребёнка; раздел взрослого, выбор профиля и экраны ABA — на языке устройства через свой экземпляр (`adultI18n`), а
 * обращённое к ребёнку внутри ABA — `useChildT`.
 */
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { getI18n, I18nextProvider, useTranslation } from 'react-i18next';

import { newProfile } from '../../services/local/profiles';
import { EMPTY_PROGRESS } from '../../services/progressPort';
import { bindChildLanguage } from '../../state/childLanguage';
import { useChildSession } from '../../state/childSession';
import i18n, { adultI18n, initI18n, setChildLang, useChildT } from '../index';

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageCode: 'ru' }]) }));

const NOW = new Date('2026-11-12T10:00:00.000Z');
const KID = '00000000-0000-4000-8000-000000000001';
const profile = (interfaceLang: 'ru' | 'en') => newProfile({ childId: KID, band: '5-6', interfaceLang, createdAt: NOW.toISOString() });

beforeEach(() => {
  useChildSession.getState().reset();
  initI18n({ lng: 'ru' });
});

describe('два экземпляра', () => {
  it('setChildLang меняет язык детских экранов, язык взрослого остаётся языком устройства', () => {
    setChildLang('en');
    expect(i18n.language).toBe('en');
    expect(adultI18n().language).toBe('ru');
    expect(i18n.t('parent.close')).toBe('Close');
    expect(adultI18n().t('parent.close')).toBe('Закрыть');
  });

  it('без сессии и для закрытого гейтом ky — язык взрослого', () => {
    setChildLang('en');
    setChildLang(null);
    expect(i18n.language).toBe('ru');
    setChildLang('ky');
    expect(i18n.language).toBe('ru');
  });

  it('закрытый ky в профиле при английском устройстве — русский, как у deviceLang', () => {
    initI18n({ lng: 'en' });
    setChildLang('ky');
    expect(i18n.language).toBe('ru');
    setChildLang(null);
    expect(i18n.language).toBe('en');
  });

  it('клон не становится экземпляром react-i18next по умолчанию: экраны без провайдера — на языке ребёнка', () => {
    expect(getI18n()).toBe(i18n);
    expect(adultI18n()).not.toBe(i18n);
  });
});

describe('язык следует за сессией ребёнка', () => {
  it('начало сессии с профилем en — английский сразу, до перерисовки; конец сессии — снова язык устройства', () => {
    const unbind = bindChildLanguage();
    try {
      useChildSession.getState().startAccountSession({ profile: profile('en'), snapshot: { ...EMPTY_PROGRESS }, now: NOW });
      expect(i18n.language).toBe('en');
      expect(adultI18n().language).toBe('ru');
      useChildSession.getState().reset();
      expect(i18n.language).toBe('ru');
      useChildSession.getState().startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'en' });
      expect(i18n.language).toBe('en');
    } finally {
      unbind();
    }
  });
});

function Probe() {
  const { t } = useTranslation();
  const childT = useChildT();
  return (
    <>
      <Text testID="adult">{t('parent.close')}</Text>
      <Text testID="child">{childT('abaSession.done')}</Text>
    </>
  );
}

describe('экраны', () => {
  it('под провайдером взрослого: обычный t — язык устройства, useChildT — язык ребёнка', async () => {
    setChildLang('en');
    await render(
      <I18nextProvider i18n={adultI18n()}>
        <Probe />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('adult').props.children).toBe('Закрыть');
    expect(screen.getByTestId('child').props.children).toBe('Done');
  });

  it('смена языка ребёнка при смонтированном экране перерисовывает useChildT, язык взрослого не трогает', async () => {
    await render(
      <I18nextProvider i18n={adultI18n()}>
        <Probe />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('child').props.children).toBe('Готово');
    await act(async () => setChildLang('en'));
    expect(screen.getByTestId('child').props.children).toBe('Done');
    expect(screen.getByTestId('adult').props.children).toBe('Закрыть');
  });

  it('без провайдера (карта, урок) — всё на языке ребёнка', async () => {
    setChildLang('en');
    await render(<Probe />);
    expect(screen.getByTestId('adult').props.children).toBe('Close');
    expect(screen.getByTestId('child').props.children).toBe('Done');
  });
});
