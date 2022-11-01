/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import nullish from './nullish';

export default function tryParse(str, defaultObj) {
  /**
   * Always accepts a string JSON and returns a JSON object
   * If optional arg provided and the string JSON is invalid, optional arg will be returned
   * @param { string }
   * string = {"some":"some","obj":{"foo":"bar"}};
   * obj2 = tryParse( string );
   * obj2 => Object{some: 'some', obj: Object{foo: 'bar'}}
   *
   * @param { string, optionalObject }
   * string = {"some":"some","obj":{"foo":"bar"}; // invalid JSON
   * default = { some: 'some' };
   * obj2 = tryParse( string, default ); // optional arg provided
   * obj2 => { some: 'some' }
   */
  let returnedObj;
  try {
    returnedObj = JSON.parse(str);

    if (nullish(returnedObj)) {
      returnedObj = defaultObj;
    }
  } catch (ex) {
    returnedObj = defaultObj;
  }

  return returnedObj;
}
