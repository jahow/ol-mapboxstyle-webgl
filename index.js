#!/usr/bin/env node
import { program } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { convertToFlatStyle } from "./convert.js";

program.argument("<path>", "path to the mapbox file as JSON");
program.parse();

async function main() {
  const path = program.args[0];
  const style = await convertToFlatStyle(path);
  // console.log(style);
  await writeFile("./output.json", JSON.stringify(style, null, "   "), {
    encoding: "utf8",
  });
}

main();
