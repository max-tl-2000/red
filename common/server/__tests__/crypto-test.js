/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { encrypt, decrypt, encryptFieldsInObject, decryptFieldsInObject, OLD_ENCRYPTION_CONFIG_KEY, encryptWithOldKey } from '../crypto-helper';

const BASE_ENCRYPTION_OBJECT = {
  applicationData: {
    fieldNotToEncrypt: 'pleaseDoNotEncryptMe',
    secretField: 'mySecretSSN',
  },
  otherData: {
    someField: 'foobar',
  },
};

describe('crypto-helper', () => {
  describe('encrypt', () => {
    it('should do a simple encryption/decryption', () => {
      const content = 'hello';
      const encrypted = encrypt(content);
      expect(encrypted).not.toEqual(content);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toEqual(content);
    });
    it('should do encryption/decryption', () => {
      const content = 'hello';
      const encrypted = encrypt(content);
      expect(encrypted).not.toEqual(content);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toEqual(content);
    });
    it('should return null when input is null', () => {
      expect(decrypt(null)).toBeNull();
    });
  });

  describe('When having data encrypted with the old encryption key and method', () => {
    it('should decrypt the data correctly', () => {
      const content = 'hello';
      const encrypted = encryptWithOldKey(content, OLD_ENCRYPTION_CONFIG_KEY);
      expect(encrypted).not.toEqual(content);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toEqual(content);
    });
  });

  describe('encrypt a field in an object', () => {
    let origObject;

    beforeEach(() => {
      origObject = JSON.parse(JSON.stringify(BASE_ENCRYPTION_OBJECT));
    });

    it('Should should not affect the original object', () => {
      const origObjectClone = JSON.parse(JSON.stringify(origObject));
      encryptFieldsInObject(origObject, ['applicationData.secretField']);
      expect(origObject).toEqual(origObjectClone);
    });

    it('Should encrypt the field and only the field', () => {
      const expectedObject = JSON.parse(JSON.stringify(origObject));
      expectedObject.applicationData.secretField = expect.stringMatching(/(?!mySecretSSN)/);
      const newObj = encryptFieldsInObject(origObject, ['applicationData.secretField']);
      expect(newObj).toEqual(expectedObject);
    });

    it('Should should not fail if field does not exist', () => {
      const resultObj = encryptFieldsInObject(origObject, ['applicationData.fieldThatDoesNotExist']);
      expect(resultObj).toEqual(origObject);
    });

    it('Should encrypt multiple fields if passed', () => {
      origObject.anothersecretField = 'shhh';
      const expectedObject = JSON.parse(JSON.stringify(origObject));
      expectedObject.applicationData.secretField = expect.stringMatching(/(?!mySecretSSN)/);
      expectedObject.anothersecretField = expect.stringMatching(/(?!shhh)/); // should NOT match shhh
      const resultObj = encryptFieldsInObject(origObject, ['applicationData.secretField', 'anothersecretField']);
      expect(resultObj).toEqual(expectedObject);
    });
  });

  describe('decrypt a field in an object', () => {
    let origObject;
    let origObjectEncrypted;

    beforeEach(() => {
      origObject = JSON.parse(JSON.stringify(BASE_ENCRYPTION_OBJECT));
      origObjectEncrypted = encryptFieldsInObject(origObject, ['applicationData.secretField']);
    });

    it('Should not affect the original object', () => {
      const origObjectClone = JSON.parse(JSON.stringify(origObjectEncrypted));
      decryptFieldsInObject(origObjectEncrypted, ['applicationData.secretField']);
      expect(origObjectEncrypted).toEqual(origObjectClone);
    });

    it('Should decrypt the field and only the field', () => {
      origObjectEncrypted = encryptFieldsInObject(origObject, ['applicationData.secretField']);
      const newObj = decryptFieldsInObject(origObjectEncrypted, ['applicationData.secretField']);
      expect(newObj).toEqual(origObject);
    });

    it('Should not fail if field does not exist', () => {
      const resultObj = decryptFieldsInObject(origObjectEncrypted, ['applicationData.fieldThatDoesNotExist']);
      expect(resultObj).toEqual(origObjectEncrypted);
    });

    it('Should decrypt multiple fields if passed', () => {
      origObject.anothersecretField = 'shhh';
      const fieldsToEncrypt = ['applicationData.secretField', 'anothersecretField'];
      origObjectEncrypted = encryptFieldsInObject(origObject, fieldsToEncrypt);
      const decryptedObject = decryptFieldsInObject(origObjectEncrypted, fieldsToEncrypt);
      expect(decryptedObject).toEqual(origObject);
    });
  });
});
