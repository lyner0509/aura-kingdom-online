"use strict";

/**
 * Sets (or changes) the admin panel password.
 *
 *   cd /var/www/aurakingdom.online/server && npm run set-password
 *
 * The password is typed here on the server and only its bcrypt hash is
 * stored. Nothing plaintext is written to disk, the repo, or the logs.
 */

const readline = require("readline");
const bcrypt = require("bcryptjs");
const { setSetting } = require("./db");

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      // Suppress echo so the password never appears on screen.
      const onData = (char) => {
        if (["\n", "\r", ""].includes(String(char))) {
          process.stdin.removeListener("data", onData);
        } else {
          process.stdout.write("[2K[200D" + question);
        }
      };
      process.stdin.on("data", onData);
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

(async () => {
  const first = await ask("New admin password (min 10 characters): ", { hidden: true });
  if (first.length < 10) {
    console.error("\nToo short. Use at least 10 characters — this password guards your whole site.");
    process.exit(1);
  }

  const again = await ask("Type it again: ", { hidden: true });
  if (first !== again) {
    console.error("\nThe two entries do not match. Nothing was changed.");
    process.exit(1);
  }

  setSetting("admin_password_hash", bcrypt.hashSync(first, 12));
  console.log("\nPassword saved. Sign in at https://aurakingdom.online/admin");
  process.exit(0);
})();
