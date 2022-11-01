/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import { validateReferrer } from '../referrerAuth';

const { expect } = chai;

describe('referrerAuth', () => {
  describe('when url contains a querystring', () => {
    it('should not throw an error', () => {
      const request = {
        authUser: {
          allowedReferrer: 'test.com',
          endpoints: ['test'],
        },
        headers: {
          referrer: 'https://www.test.com',
        },
        url: '/test?token=yJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ',
      };
      expect(() => validateReferrer({ ...request, body: { referrerUrl: 'test.com' } })).not.to.throw;
    });
  });

  describe('when url does not contain a querystring', () => {
    it('should not throw an error', () => {
      const request = {
        authUser: {
          allowedReferrer: 'test.com',
          endpoints: ['test'],
        },
        headers: {
          referrer: 'https://www.test.com',
        },
        url: '/test',
      };
      expect(() => validateReferrer({ ...request, body: { referrerUrl: 'test.com' } })).not.to.throw;
    });
  });

  describe('when the called endpoint is not in the list of allowed endpoints', () => {
    it('should throw an error', () => {
      const request = {
        authUser: {
          allowedReferrer: 'test.com',
          endpoints: ['test'],
        },
        headers: {
          referrer: 'https://www.test.com',
        },
        url: '/test1',
      };

      let thrown;
      try {
        validateReferrer({ ...request, body: { referrerUrl: 'test.com' } });
      } catch (error) {
        thrown = true;
        expect(error).to.be.ok;
        expect(error.token).to.equal('INVALID_ENDPOINT');
      }

      expect(thrown).to.be.true;
    });
  });

  describe('when the called endpoints is caught by a pattern of allowed endpoints', () => {
    it('should not throw an error', () => {
      const request = {
        authUser: {
          allowedReferrer: 'test.com',
          endpoints: ['test/'],
        },
        headers: {
          referrer: 'https://www.test.com',
        },
        url: '/test/property/units',
      };

      expect(() => validateReferrer({ ...request, body: { referrerUrl: 'test.com' } })).not.to.throw;
    });
  });

  describe('when using the `/` notation to match multiple urls under a given path', () => {
    it('should allow to call the path with the slash included', () => {
      const request = {
        authUser: {
          allowedReferrer: 'test.com',
          endpoints: ['marketing/'],
        },
        headers: {
          referrer: 'https://www.test.com',
        },
        url: '/marketing/',
      };

      expect(() => validateReferrer({ ...request, body: { referrerUrl: 'test.com' } })).not.to.throw;
    });

    it('should reject when the endpoint does not contain the trailing slash', () => {
      const request = {
        authUser: {
          allowedReferrer: 'test.com',
          endpoints: ['marketing/'],
        },
        headers: {
          referrer: 'https://www.test.com',
        },
        url: '/marketing',
      };

      let thrown;
      try {
        validateReferrer({ ...request, body: { referrerUrl: 'test.com' } });
      } catch (error) {
        thrown = true;
        expect(error).to.be.ok;
        expect(error.token).to.equal('INVALID_ENDPOINT');
      }

      expect(thrown).to.be.true;
    });
  });

  describe('when the called endpoint is not caught by a pattern of allowed endpoints', () => {
    it('should throw an error', () => {
      const request = {
        authUser: {
          allowedReferrer: 'test.com',
          endpoints: ['test/'],
        },
        headers: {
          referrer: 'https://www.test.com',
        },
        url: '/private',
      };

      let thrown;
      try {
        validateReferrer({ ...request, body: { referrerUrl: 'test.com' } });
      } catch (error) {
        thrown = true;
        expect(error).to.be.ok;
        expect(error.token).to.equal('INVALID_ENDPOINT');
      }

      expect(thrown).to.be.true;
    });
  });

  describe('when the list of allowed endpoints is empty', () => {
    it('should throw an error', () => {
      const request = {
        authUser: {
          allowedReferrer: 'test.com',
          endpoints: [],
        },
        headers: {
          referrer: 'https://www.test.com',
        },
        url: '/private',
      };

      let thrown;
      try {
        validateReferrer({ ...request, body: { referrerUrl: 'test.com' } });
      } catch (error) {
        thrown = true;
        expect(error).to.be.ok;
        expect(error.token).to.equal('INVALID_ENDPOINT');
      }

      expect(thrown).to.be.true;
    });
  });

  describe('when no allowed endpoints are specified', () => {
    it('should throw an error', () => {
      const request = {
        authUser: {
          allowedReferrer: 'test.com',
        },
        headers: {
          referrer: 'https://www.test.com',
        },
        url: '/private',
      };

      let thrown;
      try {
        validateReferrer({ ...request, body: { referrerUrl: 'test.com' } });
      } catch (error) {
        thrown = true;
        expect(error).to.be.ok;
        expect(error.token).to.equal('INVALID_ENDPOINT');
      }

      expect(thrown).to.be.true;
    });
  });

  describe('when allowed endpoints are specified', () => {
    [{ allowedReferrer: 'test.com' }, { allowedReferrer: ['test.com'] }, { allowedReferrer: ['test.com', 'super.com'] }].forEach(({ allowedReferrer }) => {
      it('should not throw an error', () => {
        const request = {
          authUser: {
            allowedReferrer,
            endpoints: ['marketing/'],
          },
          headers: {
            referrer: 'https://www.test.com',
          },
          url: '/marketing/',
        };

        expect(() => validateReferrer(request)).not.to.throw;
      });
    });
  });

  describe('when no allowed endpoints are specified', () => {
    [{ allowedReferrer: 'test.com' }, { allowedReferrer: ['test.com', 'super.com'] }].forEach(({ allowedReferrer }) => {
      it('should throw an error', () => {
        const request = {
          authUser: {
            allowedReferrer,
            endpoints: ['marketing/'],
          },
          headers: {
            referrer: 'https://www.test-invalid.com',
          },
          url: '/marketing/',
        };

        let thrown;
        try {
          validateReferrer(request);
        } catch (error) {
          thrown = true;
          expect(error).to.be.ok;
          expect(error.token).to.equal('INVALID_REFERRER');
        }

        expect(thrown).to.be.true;
      });
    });
  });
});
