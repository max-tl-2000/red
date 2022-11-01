/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPropertyIdFromURLFragment } from '../get-property-id-from-url';

describe('get-property-id-from-url', () => {
  it('should return the propertyId from urls that match', () => {
    const propertyId = getPropertyIdFromURLFragment('/properties/7096e280-4241-4d0b-93ac-7aa3ed0102df');

    expect(propertyId).toEqual('7096e280-4241-4d0b-93ac-7aa3ed0102df');
  });

  it('should return an empty string if the url does not match', () => {
    const propertyId = getPropertyIdFromURLFragment('/properties1/7096e280-4241-4d0b-93ac-7aa3ed0102df');

    expect(propertyId).toEqual('');
  });

  it('should return the propertyId even for complex urls', () => {
    const propertyId = getPropertyIdFromURLFragment('/properties/7096e280-4241-4d0b-93ac-7aa3ed0102df/some/more/path');

    expect(propertyId).toEqual('7096e280-4241-4d0b-93ac-7aa3ed0102df');
  });

  it('should return an empty string if the url does not match when no propertyId', () => {
    const propertyId = getPropertyIdFromURLFragment('/properties/');

    expect(propertyId).toEqual('');
  });

  it('should not fail if the url is undefined, null or empty', () => {
    const propertyId = getPropertyIdFromURLFragment('');
    expect(propertyId).toEqual('');

    const propertyId1 = getPropertyIdFromURLFragment(null);
    expect(propertyId1).toEqual('');

    const propertyId2 = getPropertyIdFromURLFragment(undefined);
    expect(propertyId2).toEqual('');
  });

  it('should throw if the wrong type is provided', () => {
    expect(() => getPropertyIdFromURLFragment([])).toThrowError('url is expected to be an string');
  });
});
