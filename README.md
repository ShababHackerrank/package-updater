# Package Updater CLI

A simple command-line tool to update NodeJS packages in a project

## Installation

### Prerequisites

-   Node.js 16 or higher
-   npm or yarn

### Setup

1. Clone this repository

    ```bash
    git clone https://github.com/ShababHackerrank/package-updater.git
    cd package-updater
    ```

2. Install dependencies

    ```bash
    npm install
    ```

3. Build the project

    ```bash
    npm run build
    ```

4. Link the CLI globally (optional)
    ```bash
    npm link
    ```

## Usage

You can run the CLI using:

```bash
# If you linked it globally
package-updater [command]

# If you didn't link it globally
npx tsx src/main.ts [command]
```

Or during development:

```bash
npm run dev -- [command]
```

### Available Commands

#### update

```bash
package-updater update <package>
```

### Performing Updates in hrw-lambda
1. Create a [doc](https://docs.google.com/document/d/1qiH-x6jDJIL7ojH5Crxka6F4MAv79rDPBqidRexcRw4/edit?usp=sharing) like this one
2. List out affected paths at the bottom from the Dependabot issues on Github (simple way to do this is to copy & paste all the issues and parse out the list of paths)
3. Create the CLI command - verify the package, version are correct
4. Run the command at the root of the hrw-lambda repo

#### Caveats
1. You can re-run the command multiple times, but if it sees that the package.json is already updated, then it will skip both the install and test portion. To force it to re-run, simply undo the change in the package.json file
2. Use the flag `-o` to update the resolutions section if it is a transitive dependency. Otherwise omit the `-o` flag and it will update either `dependencies` or `devDependencies`
3. If the transitive dependency is introduced by `common-packages` I recommend not using this bandaid approach and directly updating `common-packages` itself
