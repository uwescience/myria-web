A web front-end for Myria
=========================

This is a Google App Engine app.

# Dependencies

You must have the [Google App Engine SDK for Python](https://developers.google.com/appengine/downloads) installed locally.  During setup, be sure to select the option to create symbolic links to the Python utilities so that they are available from the command line.

# Initial setup
1. This project uses the [UW eScience Datalogcompiler](https://github.com/uwescience/datalogcompiler) project. We have configured it as a submodule. After cloning this repository, you must run:

  ```sh
  git submodule init
  git submodule update
  ```
  
    Then setup the module as described in the `datalogcompiler` README.
  
2. The PLY library used to parse programs in the Myria language uses a precompiled `parsetab.py` in the `datalogcompiler` submodule. This file is not required, but dramatically speeds up the parser load time (which happens for every request to the app). To generate it, run

  ```sh
  ./myrial.py examples/reachable.myl
  ```
  
  in the `datalogcompiler` subdirectory.
  
3. Launch the local App Engine emulator. I prefer to use Google's `GoogleApp EngineLauncher` application (installed with the SDK), which provides a nice GUI interface to control the emulator. From the menu select Add Existing Application, and add the `myria-web/appengine` directory.

  Alternatively, from the command line, you may launch:
  
  ```sh
  dev_appserver.py AppEngine
  ```

  And then point your browser at `localhost:8080` to view the application.

# Updating the code

To update the submodule to the latest from master, run this code:

```sh
git submodule update --recursive --remote
```
