# Unit testing

## Client Unit testing

Unit testing in the red project is done using `jest`. There are several advantages of jest over karma

- it is faster
- can execute tests in parallel
- plays well with libraries like enzyme
- watch mode only executes tests that changed or tests which required files have changed since last run
- less dependecies to manage: replacing `karma` with `jest` removed `phantomjs-prebuilt` which was a heavy dependency
  but also all `karma-*` libraries were removed as well
- it is easier to create mocks than when using `proxyquire`
- it plays well with tests that look like mocha/chai tests making it very easy to migrate the tests

### To add a test

- Create a folder `__tests__` and add the test file inside. e.g: `__tests__/my-module-test.js`
- If fixtures are needed, add them under a folder called `fixtures` this is to avoid jest from attempting to load those modules
- you can use the chai's expect and the describe/it globals as in mocha

### running the tests

```bash
npm run jest # run the tests
npm run jest -- --watch # run the tests in watch mode
```

to run a single test

```bash
# execute a test and exit
npm run jest -- path/to/module.js

# execute a test and watch for changes
npm run jest -- path/to/module.js --watch
```

### mocking modules

```javascript
// if autoClean === true (which is the default)
// module cache will be cleared between tests
// mocks will also be cleared between tests
const { mock, mockModules } = require('test-helpers/mocker').default(jest, /* autoClean = true */);

describe('test with mocks', () => {
  let module;
  let mockInstanceForModule = {}

  beforeEach(() => {
    // here we mock the module with a custom implementation
    // Note it is a function check the jest documentation
    // about mocking to understand better what's happening here
    // this method is equivalent to do `jest.mock`, but it will
    // keep track of the mock instance created and can be cleared
    // using clearMocks from the mocker module
    //
    // Note the path to the module is the path relative to this test file
    // unlike proxyquire it does not have to be the path as is used
    // inside the module we want to test
    mock('../path/to/module', () => {
      return mockInstanceForModule;
    });

    mockModules({
      '../path/to/module2' : {
        someStubbedFunction: jest.fn(),
      }
    });

    // make sure this call is done after defining the mocks
    // if any of the mocked modules is used inside the required module
    // it will use the mock instances
    require('./module-to-test');

    // the code above is equivalent to:
    // proxyquire({
    //   '../path/to/module': mockInstanceForModule,
    //   '../path/to/module2': {
    //      someStubbedFunction: jest.fn(),
    //   }
    // })

  });

  // this block is only needed if we passed autoClean = false
  // to the call that retrieve the mocker
  afterEach(() => {
    clearMocks(); // helper method to avoid manually calling unmock on every mock created
    jest.resetModules(); // needed if the same module was required several times
  })
});
```

## Server Unit testing

Modules under the server can be unit tested as well. In the long run all the unit tests (not integration) should
be managed by jest, to take advantage of its features.

In the meantime server-tests are being executed using mocha.

### adding a sever unit test

- Add the test to a folder named `__tests__`
- Add fixtures to a `fixtures` folder. e.g: `__tests__/fixtures`

### running the server unit tests

```bash
# will execute the server unit tests
npm run jest-server

# will execute the tests in watch mode
npm run jest-server -- --watch
```

