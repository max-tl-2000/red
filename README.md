# Reva

## Keeping release branches in sync

Check the [Configure mergeBranch task](resources/merge-branches/readme.md)

## Easy install for development (local using Linux)

```bash
# after clone run:
# this will check the right versions of
# node and npm are installed
# And will also only install the dependencies
# if the devDependencies or dependencies fields changed
./configure.sh

# run the db migrations
# run the app with local postgres, data is stored in ${HOME}/.red_db_data
./local.sh run

# run the app with coredb
./local.sh run --coredb

# for further options check the script help
./local.sh --help
```

## Mac user? use this quick guide to start development

1. Install docker for mac from https://www.docker.com/products/overview
2. once installed, login to the reva docker registry. The info is on the wiki! or ask a friendly developer close to you.
3. Now execute:

```bash
# always the first thing to do after any pull from master
./configure.sh

# create the nginx conf, this need to be run again if you join a different network
# for example if working from a coffee place or at home where the network is different
# from the one at the office
./bnr create:nginx:conf

# start the containers
# this might take some time, only the first time
./bnr containers:up

# create the db
./scripts/create_database.sh

# migrate it
./scripts/migrate_database.sh

# create the admin user
./scripts/create_admin.sh

# start the app in dev mode
./bnr app-start --all

# to stop the containers do
./bnr containers:stop
```

### ./bnr app-start

This command is used to start the app services. There are 6 services that can be launched using this command:

- socket
- leasing
- api
- worker
- consumer
- auth

```bash
# to start the leasing related modules and rentapp
./bnr app-start --socket --leasing --api --worker --rentapp

# to start the leasing related modules and auth
./bnr app-start --socket --leasing --api --worker --auth

# to start the leasing related modules and resexp
./bnr app-start --socket --leasing --api --worker --resexp

# to start all the modules
./bnr app-start --all
```

this command accepts the following flags:

#### `--all`
Start all the services

```bash
./bnr app-start --all # this will start all the services
```

#### `--${service}`
Where `${service}` is one of the available services: socket, leasing, api, worker, consumer and auth. These flags are used to start the services that match the name of the flag

Example:

```bash
./bnr app-start --socket --leasing --api --worker # this will start socket, leasing, api and worker services
```

#### `--skipVendors`
Skip the generation of the vendors bundles. Since vendors don't usually change, they need to be generated just once. Generating the vendors alone can be done executing:

```bash
./bnr vendors-dev # generate the vendors
```

Then we can start the app without having to generate the vendors everytime running:

```bash
./bnr app-start --all --skipVendors
```

#### `--cucumber`
Start the app without hot reloading, or debug tools since those interfere with the normal execution of cucumber tests. To speed things up no source maps are used either.

```bash
./bnr app-start --all --cucumber # launch the app prepared to execute the cucumber tests
```

#### `--debug`
This flag can be used to start one or more of the modules in debug mode.

```bash
./bnr app-start --all --debug=api --debug=worker # this will start socket, leasing, consumer and auth in normal mode and api and woker in debug mode
```

The ports will start on `9229` so in this case api debugger instance will be running in port `9229` and worker will be running in port `9230`

You can open [chrome://inspect](chrome://inspect) in your browser to see the list of debugging instances running and open each of them

#### `--debugBrk`
This flag add a breakpoint at the beginning of the processes. So you can add breakpoints from the first line of code that is executed.

#### `--production`
Will run all processes in production mode

example:

```bash
./bnr app-start --all --production
```

#### `--dashboard`
Show processes in a dashboard. When this option is passed each process will be rendered in its small window. Useful during development to avoid the mess of the log messages.

example:

```bash
./bnr app-start --all --dashboard
```

**Mac default terminal**

![screen shot 2017-02-03 at 10 43 34 pm](https://cloud.githubusercontent.com/assets/131290/22615445/08a7bdc0-ea63-11e6-8083-c41e96e0d95e.png)

**Iterm 2**

![screen shot 2017-02-03 at 10 50 53 pm](https://cloud.githubusercontent.com/assets/131290/22615464/41b4acf4-ea63-11e6-9121-d268d3ff67ee.png)


### bnr ${service}:start

`app-start` internally will call each service start command, this command can be used directly like this:

```bash
./bnr ${service}:start # where service is one of the available services: socket, leasing, api, worker, consumer and auth
```

### REDUX DEVTOOLS

If the env variable `DEVTOOLS` is set to `true` it will enable the redux devtools
during development.

If the env variable is missing or not set it will default to `true`, to disable the redux devtools
set it to false like:

```bash
export DEVTOOLS=false
```

### MOBX DEVTOOLS

if the env variable `MOBX_DEVTOOLS` is set to `true` it will enable the mobx devtools
during development

If the env variable is missing or not set it will default to `false`

```bash
export MOBX_DEVTOOLS=true # to enable the mobx devtools
```

### Debugging Reva

**IMPORTANT**: The recommended way is to [use Visual Studio Code to debug reva](./docs/debugging-with-vscode.md). But if you feel adventurous you can still use the command line approach shown below.

There are 6 services that can be debugged/launched separatedly in local

- socket
- leasing
- api
- worker
- consumer
- auth

In order to debug one of the process we just need to start the others in normal mode and then launch the one we want to debug in debug mode.

1. launch the services that won't be debugged

```bash
# the following will just start socket, leasing and worker services
./bnr app-start --socket --leasing --worker --skipVendors
```

2. In a different terminal launch the process to debug (in this case API)

```bash
./bnr api:start --debug
```

The previous command will open the debugger using port `9229` as the default one. Take in mind that if another process need to be debugged you will need to specify a different port for the second service using the `--debugPort` flag

```bash
./bnr api:start --debug --debugPort=9222 # set a different port here for the second instance
```

3. In another one launch the following command to quickly open the debugger

```bash
./bnr open:debugger
```

The previous command will quickly open the debugger that is running on the default port `9229` if a different port was used for a given instance just provide it with the flag `--debugPort`.

```bash
./bnr open:debugger --debugPort=9222 # open the debugger instance that runs in 9222 port
```

4. If more than one instance is being debugged use the `chrome://inspect` url to quickly access those debugger instances

### Running the code as in production

```bash
# run the code as in jenkins
./build.sh --ci

# start the app
./run.sh -e dev
```

#### Skip the database migrations

```bash
# -k, --skip-migrations
./run.sh -e dev -k
```

### using coredb.dev.reva.tech

For quick tests of the app without the need to actually have the database installed
you can use the database in the dev environment. For doing that you can export the variable

```bash
# add to your /etc/hosts file the following line
#
# 10.10.30.230 coredb
#
# then export the following variable
export DATABASE_HOST=coredb
```

## Installation

After cloning the repository it should be enough to execute `./configure.sh` to install all the dependencies and then proceed to the **Development** step.

## to add/remove modules

Make sure you have yarn installed globally `npm i -g yarn`

### to add

```bash
# to add a dependency
yarn add moduleName@version --exact

# to add a dev dependency
yarn add moduleName@version --dev
```

**Important**:

Due to a bug in yarn https://github.com/yarnpkg/yarn/issues/1308
some times adding or removing a module might result in a `yarn.lock`
file with the dependencies sorted in a non deterministic way.
which will make the yarn.lock file to suffer from changes on the next install
To fix this make sure you run `yarn` at least once after adding a package

### to remove

```bash
# to remove a dependency/dev dependency
yarn remove moduleName@version
```

**Important**:

Due to a bug in yarn https://github.com/yarnpkg/yarn/issues/1308
some times adding or removing a module might result in a `yarn.lock`
file with the dependencies sorted in a non deterministic way.
which will make the yarn.lock file to suffer from changes on the next install
To fix this make sure you run `yarn` at least once after adding a package

### Database creation

```bash
./scripts/create_database.sh
```

#### Database schema upgrades:

- upgrades are located under `src/databases/migrations` folder
- to create a new migration use:

  ```bash
  ./scripts/create_migration_file.sh <<migration_name>>
  ```

- to run latest migrations use:

  ```bash
  ./scripts/migrate_database.sh
  ```
- to verify applied migrations:

  ```bash
  ./scripts/migrate_database.sh --check
  ```
- to rollback last migration use:

  ```bash
  ./scripts/rollback_migration.sh
  ```

- to show the current version of the migration

  ```bash
  node_modules/knex/lib/bin/cli.js migrate:currentVersion --knexfile ./server/database/knexfile.js
  ```

## Development

Running `npm run dev` will start both the **server-side NodeJS Express application** as well as the **Webpack dev server** that will be watching the source files and when those change it will push incremental updates to the browser.

Note: changing any React component should work with hot-reloading. Changing server-side files like actions (API handlers) could require a restart of the NodeJS server.

```bash
npm run dev
```

## Production

In order to run the code in a similar way as it will be executed in production you can do:

```bash
# generate the assets
# vendors.js, main.js, main.css
npm run build

# start the app
# make sure the NODE_ENV variable is set to production
npm start

# or set it when start
NODE_ENV=production npm start
```

### Containers

Be sure you are logged in the docker registry, you can do this by running:

```bash
docker login -u testuser -p testpassword -e <your email username>@redisrupt.com https://registry.corp.reva.tech/v2
```

If not, you won't be able to pull the docker images.

To start **logstash**, **elasticsearch** and **coredb**:

```bash
docker-compose up -d logstash coredb elasticsearch
```

or just

```
docker-compose up -d logstash
```

logstash is linked to elasticsearch and coredb, that's why they will start with it.

If you only want to start one of them, for intance coredb (postgres):

```bash
docker-compose up -d coredb
```

To stop:

```bash
docker-compose stop <name of container>
```

Note: stopping logstash won't stop the other containers.

If you are using these (coredb and elasticsearch), you'll need to export `ES_HOST` and `DATABASE_HOST`. The value of them is the same, usually is `192.168.99.100`. To get the right value:

```bash
docker-machine ip <name of your machine>
```

If it's your first time starting `coredb`, you'll have to create the schema and apply the migrations. See Database Installation.

If for some reason, you need to wipe your coredb data:

```bash
docker-compose rm -f <coredb>
```

and then

```bash
docker-compose up ...
```

## Deployment to `red.dev.env.reva.tech`

```bash
$ ssh ubuntu@ci
# sudo su - jenkins
$ docker-machine ls
$ docker-machine ssh devbox1
$ sudo docker ps
$ docker exec -ti `machine_name` bash
```

## Cucumber tests

Check [this guide](./docs/cucumber.md)

## unit tests

Check [this guide](./docs/unit-testing.md)

#### API Server

This is where the meat of your server-side application goes. It doesn't have to be implemented in Node or Express at all. This is where you connect to your database and provide authentication and session management. In this example, it's just spitting out some json with the current time stamp.

#### Getting data and actions into components

To understand how the data and action bindings get into the components – there's only one, `InfoBar`, in this example – I'm going to refer to you to the [Redux](https://github.com/gaearon/redux) library. The only innovation I've made is to package the component and its wrapper in the same js file. This is to encapsulate the fact that the component is bound to the `redux` actions and state. The component using `InfoBar` needn't know or care if `InfoBar` uses the `redux` data or not.

#### Images

Now it's possible to render the image both on client and server. Please refer to issue [#39](https://github.com/erikras/react-redux-universal-hot-example/issues/39) for more detail discussion, the usage would be like below (super easy):

```javascript
let logoImage = require('./logo.png');
```

#### Styles

This project uses [local styles](https://medium.com/seek-ui-engineering/the-end-of-global-css-90d2a4a06284) using [css-loader](https://github.com/webpack/css-loader) and `css-local-loader`. The way it works is that you import your stylesheet at the top of the class with your React Component, and then you use the classnames returned from that import. Like so:

```javascript
const { locals, cf, g } = require('./App.scss');
```

Then you set the `className` of your element to match one of the CSS classes in your SCSS file, and you're good to go. If the className is not found in the scss file attempt to accessing the style will throw an Exception. This will prevent the return of undefined class

```jsx
<div className={ styles.mySection }> ... </div>
<div className={ cf('mySection otherClass') } ... </div>
<div className={ cf('mySection otherClass', g('someGlobalClass')) } ... </div>
{ /* `cf` and `g` work like the classnames module but for local classes */ }
{ /* `g` cannot be used alone it has to be used inside `cf` */ }
<div className={ cf({ mySection: true, otherClass: true, otherLocalClass: false }, g({ someGlobalClass: true, otherGlobalClass: false })) } ... </div>
```

For more info [read this](https://github.com/Redisrupt/red/wiki/Local-CSS-with-CSS-Modules)

## About

This application has been bootstrapped from [React redux universal hot example](https://github.com/erikras/react-redux-universal-hot-example)

## FAQ
### App does not start or a missing module in the console
Have you executed the `./configure.sh`? it will try to install the app dependencies. After this the app should start normally with either `npm run dev` or `local.sh run`

### Yarn lock keeps modifying after running `./configure.sh`
There are some issues with yarn where the yarn.lock is not created in a deterministic way. To fix this make sure you always execute yarn at least once after adding or removing modules
