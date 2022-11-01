/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// this is needed to make HMR work due to a bug with react-proxy
// https://github.com/gaearon/react-proxy/issues/71

const patch = require('react-proxy/modules/deleteUnknownAutoBindMethods');

function shouldDeleteClassicInstanceMethod(component, name) {
  // eslint-disable-next-line
  if ( component.__reactAutoBindMap && component.__reactAutoBindMap.hasOwnProperty( name ) ) {
    // It's a known autobound function, keep it
    return false;
  }

  if (component.__reactAutoBindPairs && component.__reactAutoBindPairs.indexOf(name) >= 0) {
    // It's a known autobound function, keep it
    return false;
  }

  if (component[name].__reactBoundArguments !== null) {
    // It's a function bound to specific args, keep it
    return false;
  }

  // It's a cached bound method for a function
  // that was deleted by user, so we delete it from component.
  return true;
}

function shouldDeleteModernInstanceMethod(component, name) {
  const prototype = component.constructor.prototype;

  const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, name);

  if (!prototypeDescriptor || !prototypeDescriptor.get) {
    // This is definitely not an autobinding getter
    return false;
  }
  const getName = prototypeDescriptor.get();

  // actual hack to make HMR work with React components that use getters
  if (!getName) {
    return false;
  }
  if (getName.length !== component[name].length) {
    // The length doesn't match, bail out
    return false;
  }

  // This seems like a method bound using an autobinding getter on the prototype
  // Hopefully we won't run into too many false positives.
  return true;
}

function shouldDeleteInstanceMethod(component, name) {
  const descriptor = Object.getOwnPropertyDescriptor(component, name);
  if (typeof descriptor.value !== 'function') {
    // Not a function, or something fancy: bail out
    return false;
  }

  if (component.__reactAutoBindMap || component.__reactAutoBindPairs) {
    // Classic
    return shouldDeleteClassicInstanceMethod(component, name);
  }
  // Modern
  return shouldDeleteModernInstanceMethod(component, name);
}

/**
 * Deletes autobound methods from the instance.
 *
 * For classic React classes, we only delete the methods that no longer exist in map.
 * This means the user actually deleted them in code.
 *
 * For modern classes, we delete methods that exist on prototype with the same length,
 * and which have getters on prototype, but are normal values on the instance.
 * This is usually an indication that an autobinding decorator is being used,
 * and the getter will re-generate the memoized handler on next access.
 */
function deleteUnknownAutoBindMethods(component) {
  const names = Object.getOwnPropertyNames(component);

  names.forEach(name => {
    if (shouldDeleteInstanceMethod(component, name)) {
      delete component[name];
    }
  });
}

patch.default = deleteUnknownAutoBindMethods;
