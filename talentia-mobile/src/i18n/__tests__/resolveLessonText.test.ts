import { resolveLessonTextKey } from '../resolveLessonText';

describe('resolveLessonTextKey', () => {
  const t = (key: string) => `STD:${key}`;

  it('non-ABA mode always uses t(key), never ABA override', () => {
    expect(resolveLessonTextKey('data.tasks.g4m_md_q1', t, false, 'en')).toBe(
      'STD:data.tasks.g4m_md_q1',
    );
    expect(resolveLessonTextKey('data.tasks.g4m_md_q1', t, false, 'ru')).toBe(
      'STD:data.tasks.g4m_md_q1',
    );
  });

  it('ABA EN uses English override when present', () => {
    const out = resolveLessonTextKey('data.tasks.g4m_md_q1', t, true, 'en');
    expect(out).not.toBe('STD:data.tasks.g4m_md_q1');
    expect(out.toLowerCase()).toMatch(/3475|3 475|thousand|four hundred/);
  });

  it('ABA RU uses Russian ABA override when present', () => {
    const out = resolveLessonTextKey('data.tasks.g4m_md_q1', t, true, 'ru');
    expect(out).toMatch(/3\s*475/);
  });

  it('ABA EN missing override falls back to t(key) before RU ABA', () => {
    const missing = 'data.tasks.__audit_missing_key_never_exists__';
    expect(resolveLessonTextKey(missing, t, true, 'en')).toBe(`STD:${missing}`);
  });
});
