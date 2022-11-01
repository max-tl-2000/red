/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { extractPreferredName, formatStringWithPlaceholders, sanitizeFilename } from '../helpers/strings';

const MESSAGE_WITH_PLACEHOLDERS = 'My name is %name% and my age is %age%.';
const repeat = (string, times) => new Array(times + 1).join(string);

describe('strings helper', () => {
  describe('Extract Preferred name from a full name', () => {
    it('It should return the first string', () => {
      expect(extractPreferredName('David Holt')).toBe('David');
    });

    it('It should return all string', () => {
      expect(extractPreferredName('Christina')).toBe('Christina');
    });
  });

  describe('Extract Preferred name from an undefined string', () => {
    it('It should return an empty value', () => {
      expect(extractPreferredName('')).toBe('');
    });
  });

  describe('Extract Preferred name from a null value', () => {
    it('It should return an empty value', () => {
      expect(extractPreferredName(null)).toBe('');
    });
  });

  describe('Format string with placheholders', () => {
    it('It should return a formatted string with all the placeholders replaced', () => {
      const replaceData = {
        '%name%': 'Mike',
        '%age%': '26',
      };
      const result = formatStringWithPlaceholders(MESSAGE_WITH_PLACEHOLDERS, replaceData);
      expect(result).toBe('My name is Mike and my age is 26.');
    });

    it('It should return a formatted string without placeholders and replace just the matched keys', () => {
      const replaceData = {
        '%name%': 'Mike',
        '%surname%': 'Myers',
      };
      const result = formatStringWithPlaceholders(MESSAGE_WITH_PLACEHOLDERS, replaceData);
      expect(result).toBe('My name is Mike and my age is .');
    });
  });

  describe('Sanitize a filename', () => {
    const REPLACEMENT = '_';

    describe('When the filename is valid', () => {
      describe('And a replacement option has not been passed', () => {
        it('Should return the same filenames', () => {
          ['the quick brown lazy dog.mp3', 'résumé'].forEach(filename => expect(sanitizeFilename(filename)).toBe(filename));
        });
      });

      describe('And a replacement option has been passed', () => {
        it('Should return the same filenames', () => {
          ['valid name.mp3', 'résumé'].forEach(filename => expect(sanitizeFilename(filename, { replacement: REPLACEMENT })).toBe(filename));
        });
      });
    });

    describe('When the filename is invalid', () => {
      describe('When the filename has invalid characters', () => {
        describe('And a replacement option has not been passed', () => {
          it('Should return the filenames without the invalid characters', () => {
            ['hello/', 'hello?', '<hello', 'hello>', '\\hello', 'hello:', 'hello*', '|hello|', '"hello"', "'hello'", '`hello`'].forEach(filename =>
              expect(sanitizeFilename(filename)).toBe('hello'),
            );
          });
        });
        describe('And a replacement option has been passed', () => {
          it('Should return the filenames with the replacement instead of the invalid characters', () => {
            ['hello/', 'hello?', 'hello<', 'hello>', 'hello\\', 'hello:', 'hello*', 'hello|', 'hello"', "hello'", 'hello`'].forEach(filename =>
              expect(sanitizeFilename(filename, { replacement: REPLACEMENT })).toBe('hello_'),
            );
          });
        });
        describe('And is left with only the extension', () => {
          it('Should return the filenames with a replacement instead of only the extension', () => {
            expect(sanitizeFilename('页面.jpg', { replaceUnicode: true })).toBe('unnamed.jpg');
          });
        });
      });

      describe('When the filename has more than one consecutive space', () => {
        it('Should return the filename with only one consecutive space', () => expect(sanitizeFilename('hello     world')).toBe('hello world'));
      });

      describe('When the filename has a null character', () => {
        describe('And a replacement option has not been passed', () => {
          it('Should return the filename without the null character', () => {
            expect(sanitizeFilename('hello\u0000world')).toBe('helloworld');
          });
        });
        describe('And a replacement option has been passed', () => {
          it('Should return the filename with the replacement instead of the null character', () => {
            expect(sanitizeFilename('hello\u0000world', { replacement: REPLACEMENT })).toBe('hello_world');
          });
        });
      });

      describe('When the filename has control characters', () => {
        describe('And a replacement option has not been passed', () => {
          it('Should return the filename without the null character', () => expect(sanitizeFilename('hello\nworld')).toBe('helloworld'));
        });
        describe('And a replacement option has been passed', () => {
          it('Should return the filename with the replacement instead of the control character', () => {
            expect(sanitizeFilename('hello\nworld', { replacement: REPLACEMENT })).toBe('hello_world');
          });
        });
      });

      describe('When the filename has restricted codes', () => {
        describe('And a replacement option has not been passed', () => {
          it('Should return the filenames without the restricted codes', () => {
            ['h?w', 'h/w', 'h*w'].forEach(filename => expect(sanitizeFilename(filename)).toBe('hw'));
          });
        });
        describe('And a replacement option has been passed', () => {
          it('Should return the filenames with the replacement instead of the restricted codes', () => {
            ['h?w', 'h/w', 'h*w'].forEach(filename => expect(sanitizeFilename(filename, { replacement: REPLACEMENT })).toBe('h_w'));
          });
        });
      });

      describe('When the filename has restricted suffixes', () => {
        it('Should return the filenames without the restricted suffixes', () => {
          ['mr.', 'mr..', 'mr ', 'mr  '].forEach(filename => expect(sanitizeFilename(filename)).toBe('mr'));
        });
      });

      describe('When the filename has relative paths', () => {
        describe('And a replacement option has not been passed', () => {
          it('Should return the filenames without the relative paths', () => {
            ['.', '..', './', '../', '/..', '/../', '*.|.'].forEach(filename => expect(sanitizeFilename(filename)).toBe('unnamed'));
          });
        });
        describe('And a replacement option has been passed', () => {
          it('Should return the filename with the replacement instead of the relative paths', () => {
            expect(sanitizeFilename('..', { replacement: REPLACEMENT })).toBe('_');
          });
        });
      });

      describe('When the filename has a reserved Windows name', () => {
        describe('And a replacement option has not been passed', () => {
          it('Should return the filenames without the reserved Windows name', () => {
            ['con', 'COM1', 'PRN', 'aux.txt', 'LPT9.asdfasdf'].forEach(filename => expect(sanitizeFilename(filename)).toBe('unnamed'));
            expect(sanitizeFilename('LPT10.txt')).toBe('LPT10.txt');
          });
        });
        describe('And a replacement option has been passed', () => {
          it('Should return the filenames with the replacement instead of the reserved Windows name', () => {
            ['con', 'COM1', 'PRN', 'aux.txt', 'LPT9.asdfasdf'].forEach(filename => expect(sanitizeFilename(filename, { replacement: REPLACEMENT })).toBe('_'));
            expect(sanitizeFilename('LPT10.txt', { replacement: REPLACEMENT })).toBe('LPT10.txt');
          });
        });
      });

      describe('When the filename has non-BMP chars in UTF-8', () => {
        const generateNonBmpFilename = (str, length) => {
          const str25x = repeat(str, length);
          const filename = `${str25x}\uD800\uDC00`;
          return {
            result: str25x,
            filename,
          };
        };

        it('Non-bmp SADDLES the limit', () => {
          const { filename, result } = generateNonBmpFilename('a', 252);
          expect(sanitizeFilename(filename)).toBe(result);
        });

        it('Non-bmp JUST WITHIN the limit', () => {
          const { filename, result } = generateNonBmpFilename('a', 251);
          expect(sanitizeFilename(filename)).toBe(result);
        });

        it('Non-bmp JUST OUTSIDE the limit', () => {
          const { filename, result } = generateNonBmpFilename('a', 253);
          expect(sanitizeFilename(filename)).toBe(result);
        });
      });
    });
  });

  describe('When an invalid replacement has been passed', () => {
    it('Should return the correct result', () => {
      expect(sanitizeFilename('.', { replacement: '.' })).toBe('unnamed');
      expect(sanitizeFilename('foo?.txt', { replacement: '>' })).toBe('foo.txt');
      expect(sanitizeFilename('con.txt', { replacement: 'aux' })).toBe('unnamed');
      expect(sanitizeFilename('valid.txt', { replacement: '/:*?"<>|' })).toBe('valid.txt');
    });
  });

  describe('When a filename is longer than 255 characters', () => {
    it('Should return a 255 characters filename', () => {
      const filename = repeat('a', 300);
      expect(filename.length).toBeGreaterThan(255);
      expect(sanitizeFilename(filename).length).toBeLessThanOrEqual(255);
    });
  });
});
