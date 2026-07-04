import { execFileSync } from "child_process";
import { existsSync, rmSync, writeFileSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { pathToFileURL } from "url";

function prismaBin() {
  return resolve("node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
}

function prismaCommand() {
  const jsCli = resolve("node_modules", "prisma", "build", "index.js");
  if (existsSync(jsCli)) return { command: process.execPath, prefix: [jsCli], shell: false };
  return { command: prismaBin(), prefix: [], shell: process.platform === "win32" };
}

function withGeneratorOutput(schema: string, output: string) {
  return schema.replace(/generator\s+client\s+\{([\s\S]*?)\}/, (_match, body: string) => {
    const lines = body
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("output"))
      .join("\n")
      .trimEnd();
    return `generator client {\n${lines}\n  output = "${output.replace(/\\/g, "/")}"\n}`;
  });
}

export async function loadIsolatedPrismaClient(
  sourceSchemaPath: string,
  tempSchemaPath: string,
  generatorOutput: string,
) {
  const sourceSchema = resolve(sourceSchemaPath);
  const tempSchema = resolve(tempSchemaPath);
  const outputDir = resolve(dirname(tempSchema), generatorOutput);

  if (!existsSync(sourceSchema)) throw new Error(`Schema not found: ${sourceSchema}`);

  const schema = withGeneratorOutput(readFileSync(sourceSchema, "utf8"), generatorOutput);
  writeFileSync(tempSchema, schema, "utf8");
  try {
    const command = prismaCommand();
    execFileSync(command.command, [...command.prefix, "generate", "--schema", tempSchema], {
      cwd: process.cwd(),
      env: process.env,
      shell: command.shell,
      stdio: "inherit",
    });
  } finally {
    rmSync(tempSchema, { force: true });
  }

  return import(pathToFileURL(resolve(outputDir, "index.js")).href);
}
