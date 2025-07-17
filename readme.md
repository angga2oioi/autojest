# Autojest

Autojest is a command-line tool that automates the generation of Jest unit tests for JavaScript/TypeScript files without existing tests. By integrating OpenAI's capabilities, it generates tests to ensure full coverage and assists in correcting them based on execution feedback.

## Table of Contents

- [Usage](#usage)
- [Configuration](#configuration)
- [Directory Structure](#directory-structure)
- [Dependencies](#dependencies)

## Usage

Autojest can be executed using the command line. To initiate, run:

```bash
npx github:angga2oioi/autojest
```

During execution, you will be prompted to specify a directory. Autojest will scan the directory for JavaScript/TypeScript files that lack corresponding Jest test files and offer to generate them.

## Configuration

Autojest requires a connection to OpenAI's API. On first run, you will be prompted to provide your connection details and configuration settings:

- Open AI Connection: The connection string to your OpenAI account.
- AI Model: The model you wish to use (e.g., "gpt-4").
- Max Retries for Tests: Number of attempts Autojest will make to revise failing tests.

Configuration details will be saved for subsequent use.

## Directory Structure

The project has the following directory structure:

```
├── .gitignore
├── index.js              # Main entry point for the command line tool
├── lib                   
│   ├── config.js         # Configuration utilities
│   ├── runner.js         # Test runner that executes generated tests
│   ├── scanner.js        # Scans for untested files
│   └── testgen.js        # Generates test code using OpenAI
├── package-lock.json     # Dependency lock file
└── package.json          # Project metadata and dependencies
```

## Dependencies

Autojest relies on several npm packages, including:

- **fast-glob**: For efficient file scanning
- **ignore**: To handle patterns for ignoring files
- **jaci**: For command-line prompts
- **openai**: To utilize OpenAI's API for test generation

---

For more information, please check the repository on [GitHub](https://github.com/angga2oioi/autojest). Enjoy using Autojest!