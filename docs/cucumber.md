# Cucumber tests

## Running cucumber in development

You will need 2 terminal sessions to run the tests against your local. By default the development environment will test against a standalone selenium hub service with Chrome as a preconfigured browser. This service is provided by a docker selenium image. If you still wish to run the tests against a local installation of Chrome, the key `cucumber.selenium.browser.name` in the development configuration file must be changed to `CHROME_LOCAL`.

In one session run:

```bash
# in osx or linux you can use this to start the red backend services
npm run backend:start
```

Then in another session run:

```bash
# in osx or linux you can use this to start the red frontend services
npm run frontend:start -- --cucumber
```

In a new session

```bash
# run the tests inside the chrome container
# start the chrome container
./bnr chrome:container:start -d

# once app is up you can execute the tests:
./bnr cucumber-local --useContainer -- --tags=@Demo
```

**IMPORTANT**:

This assumes you have `cucumber.local.env.reva.tech`, `admin.local.env.reva.tech`, `application.local.env.reva.tech` and `resident.local.env.reva.tech` in your `/etc/hosts/` file pointing to `127.0.0.1`. If you are using the vpn you can safely ignore this warning.

### Debugging with the standalone selenium service
The browser tests execution can be debugged by accessing the service through the selenium server:
http://localhost:4444/grid/admin/live

### Running only tests that match certain tags

#### Running tests that match all the provided tags (logical and)

Just pass as many `--tags` flags as tags you want to match

```bash
# please notice the weird `--`:
# - `--` will be consumed by `npm run cucumberjs`
#   called inside `npm run cucumber-local`.
./bnr cucumber-local --useContainer -- --tags @Core --tags @Positive
```

#### Running tests that match any of the provided tags (logical or)

Just pass a single `--tags` flag and list your tags in a comma separated list

```bash
# please notice the weird `--`, read explanation above
./bnr cucumber-local --useContainer -- --tags @Core,@Positive

```

### Strived for memory? Try the --memLimit setting when starting the app
```bash
# in terminal 1
npm run backend:start -- -- -- --memLimit=384
```

```bash
# in terminal 2
frontend:start -- --memLimit=384 --cucumber
```

## Running cucumber tests against dev environment

This one is simpler. Just run:

```bash
# run the tests and produce human readable output
npm run cucumber-dev

# or

# to generate the report as json
npm run cucumber-report-dev
```

## Running the tests inside jenkins

This command probably will never have to be called manually. It is called by Jenkins durin PR tests

```bash
npm run cucumber-report-test
```
