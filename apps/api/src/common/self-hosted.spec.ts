import { isSelfHosted } from './self-hosted';

describe('isSelfHosted', () => {
  const originalSelfHosted = process.env.SELF_HOSTED;

  afterEach(() => {
    if (originalSelfHosted === undefined) {
      delete process.env.SELF_HOSTED;
    } else {
      process.env.SELF_HOSTED = originalSelfHosted;
    }
  });

  it.each(['true', '1', 'yes', 'on', 'TRUE'])(
    'returns true for %s',
    (value) => {
      process.env.SELF_HOSTED = value;
      expect(isSelfHosted()).toBe(true);
    },
  );

  it.each(['false', '0', 'no', '', undefined])(
    'returns false for %s',
    (value) => {
      if (value === undefined) {
        delete process.env.SELF_HOSTED;
      } else {
        process.env.SELF_HOSTED = value;
      }
      expect(isSelfHosted()).toBe(false);
    },
  );
});
