# Auth Application

## Install

So far this project is part of the main red repo, so cloning the red repo will retrieve Auth Application too.

once the project is cloned, just do

```bash
# this should take care of configuring everything
./configure.sh
```

## Running the app

This app for now uses the apis from red, so the red app needs to be started first. Then in other terminal you can run
the Auth Applications app.

```bash
# to start the red app
npm run dev

# since we only need the api server we can
# start it directly and avoid having to start
# the full app
node_modules/.bin/bnr start-dev-api

# start the Auth application app
npm run auth:start-dev
```

## Conventions

Apart from using the airbnb coding standards and style guide, we're also enforcing the following

- Avoid default ES6 export
- Verify if it is possible to use `reduce` or `reduceRight` methods to iterate over lists and produce new data
  structures from original ones.
- No more than one local css file per component. If there is a need to have more than one, it is often a sign that
  a new component can be factorized out with the common css
- File names should be consisten accross the app (we're enforcing kebab-case for files and folder names)
- Derive data when possible instead of explicitly set it (@computed properties in mobx)
- Dates should always be in ISO format (YYYY-MM-DDTHH:mm:ss+z) or (YYYY-MM-DD)
- `components` folder for now contains the Generic components. Once they are moved to their own repo, `custom-components` can be
  renamed to components. `custom-components` are the ones that access data from the stores or view models. So any component that
  has a reference for a store it is not longer generic, so it should be moved to its own folder.

These conventions should be enforced by code review until we have time to add a lint rule for the ones that are not automatically enforced.


