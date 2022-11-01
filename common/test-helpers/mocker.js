/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/**
 * wraps the jest runtime and return some helpers to create mocks in an easier way
 *
 * @example
 * ```
 * // initialize the helpers
 * const { clearMocks, mockModules } = require('test-helpers/mocker').default(jest);
 * ```
 *
 * @param      {Object}  jestRuntime  The jest runtime
 * @return     {Object}  an object with the following methods: mock, mockModules and clearModules
 *                       check their descriptions below
 */
const mockWrap = (jestRuntime, autoCleanUp = true) => {
  let mocks = {};

  /**
   * mock a module using the jest.mock method, but keep track of the mocked module
   * so it can be unmocked with the clearMocks method.
   * The signature is the same as the original jest method.
   * check https://facebook.github.io/jest/docs/api.html#jestmockmodulename-factory-options
   *
   * @param      {String}  moduleName  The module name
   * @param      {function}  factory   The factory a function that return the instances
   *                                   to be returned when calling require on this module
   * @param      {Object}  options     The options
   * @return     {void}
   */
  const mock = (moduleName, factory, options) => {
    mocks[moduleName] = true;
    jestRuntime.mock(moduleName, factory, options);
  };

  /**
   * remove all mocks that were created with the mock helper function
   * described above. Usually used in a `afterEach` block
   *
   * @example
   * ```
   * // get the mockModules method
   * const { clearMocks, mockModules } = require('test-helpers/mocker').default(jest);
   *
   * beforeEach(() => {
   *    // create some mocks with the mockModule helper
   *    mockModule({
   *      './console-wrapper' : {
   *         log: jest.spy(),
   *      }
   *    });
   * });
   *
   * // now you use the clearMocks to remove the created mocks
   * afterEach(mockModules);
   * ```
   * @return     {<type>}  { description_of_the_return_value }
   */
  const clearMocks = () => {
    Object.keys(mocks).forEach(key => jestRuntime.unmock(key));
    mocks = {};
  };

  /**
   * helper function to mock several modules using an object hash which keys map to the
   * modules to be mocked and the value of the keys are the return value from the
   * factory functions. Sometimes is required to call `jest.resetModules()` in order to
   * clear the require cache so the mocked modules are returned from the `require` calls.
   *
   * @example
   * ```
   * // get the mockModules method
   * const { mockModules } = require('test-helpers/mocker').default(jest);
   *
   * jest.resetModules(); // clear the cache
   * // mock the modules
   * mockModules({
   *   '../path/to/module': {
   *      methodToStubInModule: jest.spy(),
   *      anotherMethodToSub: jest.spy(),
   *   }
   *   '../path/to/another': {
   *      someField: {},
   *   },
   * });
   * ```
   *
   * @param      {Object}  hash    The hash
   * @return     {void}
   */
  const mockModules = hash => {
    Object.keys(hash).forEach(moduleName => mock(moduleName, () => hash[moduleName]));
  };

  if (autoCleanUp) {
    afterEach(clearMocks);
  }

  return { mock, clearMocks, mockModules };
};

export default mockWrap;
