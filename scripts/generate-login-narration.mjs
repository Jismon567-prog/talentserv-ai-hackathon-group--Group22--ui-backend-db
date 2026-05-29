/**
 * Generates public/audio/login-overview.mp3 via OpenAI TTS (male voice: onyx).
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npm run generate:login-audio
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "audio");
const outFile = path.join(outDir, "login-overview.mp3");

const LOGIN_NARRATION_TEXT =
  "Welcome to OpenMRS AI Agent. This healthcare test automation assistant turns your requirements into ready-to-use OpenMRS test plans. After you sign in, describe a workflow or choose a sample, and our six-stage AI pipeline generates test cases—from functional and negative to security, privacy, and audit—plus one hundred percent synthetic patient data and Playwright automation skeletons. We never use real PHI. Sign in to open your dashboard and start generating.";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY. Set it and re-run npm run generate:login-audio");
    process.exit(1);
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  console.log("Generating login overview audio (voice: onyx)...");
  const response = await client.audio.speech.create({
    model: "tts-1",
    voice: "onyx",
    input: LOGIN_NARRATION_TEXT,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, buffer);
  console.log(`Wrote ${outFile} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
