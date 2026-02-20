# Multi-File Workspace Example

Tests that `include` and `use` statements work correctly in OpenSCAD Studio.

## File structure

```
main.scad        ← Open this file to test
├── config.scad  ← included (variables available directly)
├── parts.scad   ← used (only modules/functions available)
│   └── helpers.scad  ← used by parts.scad (transitive dependency)
```

## What it tests

- `include <file.scad>` — variables from config.scad are available in main.scad
- `use <file.scad>` — modules from parts.scad are callable from main.scad
- **Transitive dependencies** — parts.scad uses helpers.scad, which should also resolve
- Multiple parts rendered on a base plate using shared configuration

## How to test

1. Open `main.scad` in OpenSCAD Studio
2. The preview should render a base plate with 6 parts arranged in two rows
3. If includes are broken, you'll see errors about undefined modules or variables
