#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function error(msg: string) {
  console.error(msg);
  process.exit(1);
}

const unparsed_args = process.argv.slice(2);

// basic arg parsing (no long form)
let args: string[] = [];
const options = {
  a: 'out'
}
for (let i = 0; i < unparsed_args.length; i++) {
  const arg = unparsed_args[i];
  if (!arg.startsWith('-')) {
    args = unparsed_args.slice(i);
    break;
  } else {
    if (arg === '-a') {
      options.a = unparsed_args[i + 1];
      if (!options.a) {
        error(`-a was specified, need to have value set to the artifacts path, default to out`);
      }
      i += 1;
    } else {
      error(`arg not recognized: ${arg}`);
    }
  }
}


const output_path = args[0];

const output_type: 'js' | 'ts' | 'js,ts' | 'ts,js' = (args[1] as ('js' | 'ts' | 'js,ts' | 'ts,js')) || 'ts';
if (output_type !== 'ts' && output_type !== 'js' && output_type !== 'js,ts' && output_type !== 'ts,js') {
  error(`invalid type specified, only support "js" or "ts"`);
}


async function main() {
  try {
    fs.rmSync(output_path, { recursive: true })
    fs.mkdirSync(output_path, { recursive: true })
  } catch { }
  const artifact_folder = options.a;

  const sol_files = fs.readdirSync(artifact_folder);
  for (const sol_file of sol_files) {
    const sol_path = path.join(artifact_folder, sol_file);
    if (fs.statSync(sol_path).isDirectory()) {
      const artifact_files = fs.readdirSync(sol_path);
      for (const artifact_file of artifact_files) {
        const artifact_path = path.join(sol_path, artifact_file);
        if (fs.statSync(artifact_path).isFile() && artifact_path.endsWith(".json")) {
          const content = fs.readFileSync(artifact_path, 'utf-8');
          const parsed = JSON.parse(content);
          if ("abi" in parsed && parsed.abi && parsed.abi.length > 0) {
            const contract: { abi: any, bytecode?: string } = { abi: parsed.abi };
            if ("bytecode" in parsed && parsed.bytecode?.object) {
              contract.bytecode = parsed.bytecode.object;
            }
            const contractAsJsonString = JSON.stringify(contract, null, 2);
            const ts = `export default ${contractAsJsonString} as const;`;
            const js = `export default /** @type {const} **/ (${contractAsJsonString});`

            if (output_type === 'ts' || output_type === 'js,ts' || output_type === 'ts,js') {
              fs.writeFileSync(path.join(output_path, `${sol_file}:${path.basename(artifact_file, '.json')}.ts`), ts);
            }
            if (output_type === 'js' || output_type === 'js,ts' || output_type === 'ts,js') {
              fs.writeFileSync(path.join(output_path, `${sol_file}:${path.basename(artifact_file, '.json')}.js`), js);
            }
          }
        }
      }
    }
  }
}

main();
