# Debugging with VSCode

Visual Studio code can be used to debug/launch our services (`red`/`consumer`/`auth`/`leasing`/`worker`/`api`/`socket`). This will use the vscode integrated debugger.

The main advantage of this approach over the command line (which still works by the way) is that *this one fully supports source maps* and also *conditional breakpoints*.
It also makes simpler to stop/start individual services without having to restart all of them everytime which takes time and recompile the frontend assets everytime

here is a video for reference https://www.youtube.com/watch?v=kqLRCoClfko

## Instructions

1. create a folder called `.vscode` inside the project root (it will be ignored so don't worry about adding it to the repo)
2. add `launch.json` file inside this folder and use the following content

```json
{
  // Use IntelliSense to learn about possible Node.js debug attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "sourceMaps": true,
      "name": "consumer",
      // sadly this one doesn't show variables values when hovering them
      // the legacy one does it though and it is as fast as the new one
      // "protocol": "inspector",
      "program": "${workspaceRoot}/consumer/bin/server.js",
      "env": {
        "DEBUG": "true",
        "CONSUMER_PORT": "4000",
        "RED_LOG_LEVEL": "error",
        "RED_PROCESS_NAME": "consumer-server"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "sourceMaps": true,
      "name": "auth",
      "program": "${workspaceRoot}/auth/bin/server.js",
      "env": {
        "DEBUG": "true",
        "AUTH_PORT": "3500",
        "RED_LOG_LEVEL": "error",
        "RED_PROCESS_NAME": "auth-server"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "sourceMaps": true,
      "name": "server",
      "program": "${workspaceRoot}/bin/server.js",
      "env": {
        "DEBUG": "true",
        "NODE_PATH": "./server",
        "RED_PROCESS_NAME": "leasing-server",
        "PORT": "3000",
        "RED_LOG_LEVEL": "error",
        "API_PORT": "3030"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "sourceMaps": true,
      "name": "api",
      "program": "${workspaceRoot}/bin/api.js",
      "env": {
        "DEBUG": "true",
        "NODE_PATH": "./server/api",
        "RED_PROCESS_NAME": "api",
        "API_PORT": "3030",
        "RED_LOG_LEVEL": "error"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "sourceMaps": true,
      "name": "worker",
      "program": "${workspaceRoot}/bin/worker.js",
      "env": {
        "DEBUG": "true",
        "NODE_PATH": "./server/workers",
        "RED_PROCESS_NAME": "workers",
        "RED_LOG_LEVEL": "error",
        "API_PORT": "3030"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "sourceMaps": true,
      "name": "socket",
      "program": "${workspaceRoot}/bin/socket.js",
      "env": {
        "DEBUG": "true",
        "NODE_PATH": "./server/socket",
        "RED_LOG_LEVEL": "error",
        "RED_PROCESS_NAME": "socket",
        "API_PORT": "3030"
      }
    }
  ]
}
```

3. Use the debugging section of Visual Studio Code to launch each one of the services.

   **NOTE:** The recommended order is: `socket`, `api`, `workers`, `leasing`, `consumer` and `auth`

4. Add breakpoints to the gutter of the any file you would like to debug
5. If breakpoints don’t hit, stop the debugging session and use a `debugger;` statement in the place you want the code to be stopped. Restart the debugging session.