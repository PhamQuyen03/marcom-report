import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const reportsRoot = path.resolve("public/reports");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const rootStat = await stat(reportsRoot).catch(() => null);
  if (!rootStat || !rootStat.isDirectory()) {
    throw new Error(`Missing reports directory: ${reportsRoot}`);
  }

  const files = await walk(reportsRoot);
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  const indexFiles = htmlFiles.filter((file) => path.basename(file) === "index.html");

  if (htmlFiles.length === 0) {
    throw new Error("No HTML files found under public/reports");
  }

  const invalidNames = htmlFiles.filter((file) => /\s/.test(path.relative(reportsRoot, file)));
  if (invalidNames.length > 0) {
    throw new Error(
      `HTML paths must not contain spaces:\n${invalidNames
        .map((file) => `- ${path.relative(reportsRoot, file)}`)
        .join("\n")}`,
    );
  }

  console.log(`Validated ${htmlFiles.length} HTML files under public/reports`);
  console.log(`Detected ${indexFiles.length} versioned index.html endpoints`);
  console.log(`Detected ${htmlFiles.length - indexFiles.length} direct HTML endpoints`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
