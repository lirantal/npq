'use strict';
// #!/usr/bin/env node
// usage: node calculate-diff.js --path /path/to/project --add "left-pad@1.3.0"

const path = require('path');
const fs = require('fs');
const Arborist = require('@npmcli/arborist');
const Diff = require('@npmcli/arborist/lib/diff');

// function parseArgs() {
//   const out = { path: process.cwd(), add: null };
//   for (let i = 2; i < process.argv.length; i++) {
//     const arg = process.argv[i];
//     if ((arg === '--path' || arg === '-p') && process.argv[i + 1]) {
//       out.path = process.argv[++i];
//     } else if ((arg === '--add' || arg === '-a') && process.argv[i + 1]) {
//       out.add = process.argv[++i];
//     }
//   }
//   return out;
// }

async function main() {
//   const args = parseArgs();

    const args = {}
    args.path = process.cwd();
    args.add = "ai";

  const projectPath = path.resolve(args.path);
  if (!fs.existsSync(projectPath)) {
    console.error('Project path does not exist:', projectPath);
    process.exit(1);
  }

  // instantiate Arborist pointing at the project. Add registry/auth options here if needed.
  const arb = new Arborist({ path: projectPath });

  // Load the actual tree if node_modules exists (this returns the root node)
  // If you only have a package-lock.json and no node_modules, loadVirtual() is the method that reads lockfile/yarn.lock
  let actual;
  try {
    actual = await arb.loadActual();
  } catch (err) {
    // loadActual may fail if there's no node_modules; that's okay, we'll still have an "actual" value undefined/null
    actual = arb.actualTree || undefined;
  }

  // If you have a lockfile and want to build from it, ensure the virtual tree is loaded first.
  // (If you already have node_modules, buildIdealTree will still consult lockfiles.)
  try {
    await arb.loadVirtual();
  } catch (err) {
    // loadVirtual will throw if there's no package-lock.json/package.json; ignore if not using it.
  }

  // Build the ideal tree with the new dependency. `add` takes an array of specifiers (e.g. 'foo@1.2.3').
  // You can pass saveType, update, prune, etc. as needed.
  const addSpec = args.add ? [args.add] : [];
  await arb.buildIdealTree({ add: addSpec });

  // After buildIdealTree, the ideal tree should be available on arb.idealTree
  const ideal = arb.idealTree || arb.virtualTree;

  // Compute the diff between the actual and ideal trees.
  const diffRoot = Diff.calculate({ actual, ideal });

  // Walk the diff tree and collect nodes with action === 'ADD'
  const adds = [];
  function walk(diffNode) {
    // Diff nodes have an `action` property (ADD / REMOVE / CHANGE / null)
    if (diffNode.action === 'ADD') {
      const idealNode = diffNode.ideal;
      if (idealNode && idealNode.package) {
        adds.push({
          name: idealNode.package.name,
          version: idealNode.package.version,
          location: idealNode.location,
          resolved: idealNode.resolved || null,
          integrity: idealNode.integrity || null,
        });
      }
    }
    if (Array.isArray(diffNode.children)) {
      for (const child of diffNode.children) walk(child);
    }
  }
  walk(diffRoot);

  console.log(JSON.stringify({ added: adds }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});