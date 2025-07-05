# ZEROTHROW OPERATIONAL MANUAL 🎯

## 🧠 MEMORY PROTOCOL

**START EVERY SESSION:**
```bash
mcp__basic-memory__search query: '{ "text": "zerothrow" }' --page_size 5
```

**SAVE ALL DYNAMIC CONTENT TO MEMORY:**
```bash
# SITREPs
folder: "projects/zerothrow/sitreps"
tags: ["#zerothrow", "#sitrep"]

# Architecture decisions  
folder: "projects/zerothrow/decisions"
tags: ["#zerothrow", "#architecture"]

# TODOs and roadmap
folder: "projects/zerothrow/todos"
tags: ["#zerothrow", "#roadmap"]
```

## 🚀 CORE API

### The 99% Case
```typescript
import { ZT } from '@zerothrow/core'

ZT.try(() => risky())      // Wrap throwing functions
ZT.tryAsync(async () => {}) // Async operations
ZT.ok(value)               // Create success
ZT.err(error)              // Create failure
```

### Result Combinators
```typescript
result
  .map(x => x * 2)         // Transform success value
  .mapErr(e => wrap(e))    // Transform error
  .andThen(x => validate(x)) // Chain operations
  .match({                 // Pattern match
    ok: (val) => val,
    err: (err) => fallback
  })
```

## 🛠️ ZT CLI COMMANDS

```bash
# Setup (creates dev-mode wrapper)
npm run zt:install

# Daily drivers
zt validate              # Pre-push checks
zt validate --fix        # Auto-fix issues  
zt ecosystem sync        # Update ECOSYSTEM.md
zt package ready --fix   # Fix package issues
zt package init --name x # Create new package
```

## ⚔️ COMMIT PROTOCOL

**FORMAT:**
```
[{package}] {type}: {subject}

{body}

Co-Authored-By: Claude <noreply@anthropic.com>
```

**RULES:**
- One package per commit
- Micro-commits for each logical change
- Always create feature branches from origin/main
- Run `zt validate` before push

## 📦 PACKAGE STANDARDS

Every package MUST have:
- `type: "module"`
- `sideEffects: false`
- `engines: { node: ">=18.17.0" }`
- `publishConfig: { access: "public" }`
- SPDX headers in all source files
- README with ecosystem link
- Zero devDependencies in published packages

## 🎯 ACTIVE MISSIONS

Check memory for current objectives:
```bash
mcp__basic-memory__search query: '{ "text": "zerothrow", "types": ["todo"] }'
```

## 🔧 TROUBLESHOOTING

**Missing peer deps:** Always install `@zerothrow/core` with other packages
**Old API references:** Search for `tryR` - should be `try`
**Package not ready:** Run `zt package ready --fix`

## 📡 EXTERNAL RESOURCES

- Repo: https://github.com/zerothrow/zerothrow
- NPM: https://www.npmjs.com/org/zerothrow
- Issues: https://github.com/zerothrow/zerothrow/issues

---

**Remember:** All dynamic content lives in basic-memory, not this file.

**HOO-RAH!** 🎖️