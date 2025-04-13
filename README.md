# Package Updater CLI

A simple command-line task management tool built with Node.js and TypeScript.

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

## Project Structure

```
package-updater/
├── src/
│   └── index.ts    # Main CLI application
├── .dist/          # Compiled JavaScript files
├── package.json    # Dependencies and scripts
├── tsconfig.json   # TypeScript configuration
└── README.md       # Documentation
```

## Development

### Running in Development Mode

```bash
npm run dev -- [command]
```

### Building the Project

```bash
npm run build
```
