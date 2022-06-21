# find-unused-gauge-steps

* *CAUTION* This project is still work in progress.
* A zx script to find unused steps and concepts defined in kotlin gauge project

## Usage

```sh
$ npm install
$ npm run exec <path to gauge project>
```

## Tested Environment
* Node.js
  * 18.4.0
* OS
  * OS X 12.1 (for now!)
  * Ubuntu 20.04.3 LTS

## Known Side Effects
* Add a newline to spec files if they do not end with one.
  * This feature prevents `cat` command from ommitting the last line.
