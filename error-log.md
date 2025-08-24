# Jules's Error & Resolution Log

This document tracks build errors and other mistakes encountered during development. The purpose is to learn from these mistakes and avoid repeating them.

---

### **Error 1: Missing Radix UI Dependencies**

*   **Date:** 2025-08-24
*   **Error Message:** `[vite]: Rollup failed to resolve import "@radix-ui/react-progress" from "/opt/buildhome/repo/src/components/ui/progress.jsx".`
*   **Root Cause:** I added new UI components (`dialog.jsx`, `progress.jsx`) by copying the standard `shadcn/ui` code. However, I failed to identify and install their underlying dependencies from the Radix UI library (`@radix-ui/react-dialog`, `@radix-ui/react-progress`).
*   **Solution:**
    1.  Carefully read the error message to identify the exact package that could not be resolved.
    2.  Run `npm install <package-name>` to add the missing dependency to `package.json`.
    3.  **Future Prevention:** Whenever I add a new component from an external source or library, I must first check its documentation or source code for its dependencies and install them *before* attempting to build.

---

### **Error 2: `package-lock.json` Out of Sync**

*   **Date:** 2025-08-24
*   **Error Message:** `npm ci can only install packages when your package.json and package-lock.json are in sync.`
*   **Root Cause:** The CI/CD environment uses `npm ci` for fast, reproducible builds. This command requires the `package.json` and `package-lock.json` files to be perfectly synchronized. My local `npm install <package-name>` command had updated the lockfile in a way that introduced inconsistencies, possibly by updating transitive dependencies.
*   **Solution:**
    1.  Delete the local `node_modules` directory (`rm -rf node_modules`) and the `package-lock.json` file (`rm package-lock.json`).
    2.  Run `npm install` with no arguments. This generates a fresh, clean `package-lock.json` based *only* on the packages listed in `package.json`.
    3.  Commit the newly generated `package-lock.json`.
    4.  **Future Prevention:** After adding or updating dependencies, it is a good practice to perform this clean reinstall process to avoid CI conflicts.

---

### **Error 3: Missing Component File**

*   **Date:** 2025-08-24
*   **Error Message:** `Could not load /opt/buildhome/repo/src/components/ui/avatar (imported by src/components/LivePreview.jsx)`
*   **Root Cause:** I wrote code in `LivePreview.jsx` that imported and used an `<Avatar>` component, but I had forgotten to actually create the `src/components/ui/avatar.jsx` file. This was a simple but critical oversight.
*   **Solution:**
    1.  Create the missing file (`avatar.jsx`).
    2.  Add the necessary component code.
    3.  Check if this new component has its own dependencies (it did: `@radix-ui/react-avatar`) and install them.
    4.  **Future Prevention:** When implementing a component that uses other custom components, I must ensure those child components exist *before* trying to use them. I need to be more diligent in tracking my own component dependencies.

---

### **Error 4: Incorrect Component Import**

*   **Date:** 2025-08-24
*   **Error Message:** `"Icons" is not exported by "src/components/ui/Icons.jsx"`
*   **Root Cause:** The code in `App.jsx` was trying to import an object named `Icons` using `import { Icons } from ...`. However, the `Icons.jsx` file does not export an `Icons` object. It exports several individual components using named exports (e.g., `export const Rocket = ...`).
*   **Solution:**
    1.  Inspect the exporting file (`Icons.jsx`) to understand its actual exports.
    2.  Modify the importing file (`App.jsx`) to match. The import was changed from `import { Icons } from ...` to `import { Rocket } from ...`.
    3.  The usage was changed from `<Icons.logo ... />` to `<Rocket ... />`.
    4.  **Future Prevention:** Before importing from a file, I must be certain of what it exports. If an import fails, my first step should always be to check the source file's `export` statements. Do not assume the shape of the export.
