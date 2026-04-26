import { createInterface } from "node:readline";

export function printError(message: string): void {
  process.stderr.write(`\x1b[31merror:\x1b[0m ${message}\n`);
}

export function printSuccess(message: string): void {
  process.stderr.write(`\x1b[32msuccess:\x1b[0m ${message}\n`);
}

export function promptSelect(question: string, options: string[]): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    process.stderr.write(`${question}\n`);
    options.forEach((opt, i) => {
      process.stderr.write(`  ${i + 1}. ${opt}\n`);
    });

    rl.question("Enter number: ", (answer) => {
      rl.close();
      const index = Number.parseInt(answer, 10) - 1;
      const selected = options[index];
      if (selected === undefined) {
        printError("Invalid selection.");
        process.exit(1);
      }
      resolve(selected);
    });
  });
}
