/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { detectBrowserFromReq, internalSupportedBrowsers } from '../browser-detector.ts';

describe('browser-detector', () => {
  describe('mobile browsers', () => {
    it('should detect Samsung Mobile browser', () => {
      const res = detectBrowserFromReq(
        {
          headers: {
            'user-agent':
              'Mozilla/5.0 (Linux; Android 10; SAMSUNG SM-N975U1) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/11.0 Chrome/75.0.3770.143 Mobile Safari/537.36',
          },
        },
        internalSupportedBrowsers,
      );

      expect(res).toMatchSnapshot();
    });
  });

  describe('firefox', () => {
    it('should detect Firefox on mobile', () => {
      const res = detectBrowserFromReq(
        {
          headers: {
            'user-agent': 'Mozilla/5.0 (Android 10; Mobile; rv:68.0) Gecko/68.0 Firefox/68.0',
          },
        },
        internalSupportedBrowsers,
      );

      expect(res).toMatchSnapshot();
    });
  });

  describe('In case of safari', () => {
    it('should be supported if version >= 11', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/604.1.28 (KHTML, like Gecko) Version/11.0 Safari/604.1.28',
        },
      });
      expect(res).toMatchSnapshot();
    });

    it('should not be supported if version < 10', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/9.1.2 Safari/603.3.8',
        },
      });
      expect(res).toMatchSnapshot();
    });
  });

  describe('In case of chrome', () => {
    it('should be supported if version >= 56', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36',
        },
      });
      expect(res).toMatchSnapshot();
    });

    it('should not be supported if version < 56', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.3112.101 Safari/537.36',
        },
      });
      expect(res).toMatchSnapshot();
    });
  });

  describe('In case of Firefox', () => {
    it('should be supported if version >= 52', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0',
        },
      });
      expect(res).toMatchSnapshot();
    });

    it('should not be supported if version < 52', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/51.0',
        },
      });
      expect(res).toMatchSnapshot();
    });
  });

  describe('In case of IE', () => {
    it('should not be supported if version >= 11', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': '"Mozilla/5.0 (Windows NT 6.3; Trident/7.0; .NET4.0E; .NET4.0C; rv:11.0) like Gecko"',
        },
      });
      expect(res).toMatchSnapshot();
    });
    it('should not be supported if version < 11', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)',
        },
      });
      expect(res).toMatchSnapshot();
    });
  });

  describe('In case of Edge', () => {
    it('should be supported if version >= 12', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10586',
        },
      });
      expect(res).toMatchSnapshot();
    });

    it('should not be supported if version < 12', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/11.10586',
        },
      });
      expect(res).toMatchSnapshot();
    });

    it('should detect google bot', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent':
            'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        },
      });

      expect(res.isABot).toEqual(true);
    });

    it('should detect ahrefsBot bot', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; AhrefsBot/5.2; +http://ahrefs.com/robot/)',
        },
      });

      expect(res.isABot).toEqual(true);
    });

    it('should detect generic bots', () => {
      const res = detectBrowserFromReq({
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; AlphaRobot/3.2; +http://alphaseobot.com/robot.html)',
        },
      });

      expect(res.isABot).toEqual(true);
    });
  });
});
