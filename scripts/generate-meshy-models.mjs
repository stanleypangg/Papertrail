import fs from 'fs/promises';
import path from 'path';

const MESHY_API_KEY = "msy_J8KJaQL0drqlI0oCjuUQ9qb0brcirPj87xAB";
const MESHY_API_BASE = "https://api.meshy.ai/openapi/v2";

const characters = [
  { id: "harry-potter", prompt: "Harry Potter, teenage wizard with glasses and a lightning scar, wearing gryffindor robes, high quality 3d model, standalone character, t-pose" },
  { id: "severus-snape", prompt: "Professor Severus Snape, pale skin, long greasy black hair, wearing flowing black robes, high quality 3d model, standalone character, t-pose" },
  { id: "draco-malfoy", prompt: "Draco Malfoy, teenage wizard with slicked back pale blonde hair, wearing slytherin robes, high quality 3d model, standalone character, t-pose" },
  { id: "hermione-granger", prompt: "Hermione Granger, teenage witch with bushy brown hair, wearing gryffindor robes, carrying a book, high quality 3d model, standalone character, t-pose" },
  { id: "luna-lovegood", prompt: "Luna Lovegood, teenage witch with long straggly blonde hair, wearing ravenclaw robes and radish earrings, high quality 3d model, standalone character, t-pose" }
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestMeshy(endpoint, method, body) {
  const url = `${MESHY_API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${MESHY_API_KEY}`,
      "Content-Type": "application/json"
    }
  };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function generateModel(char) {
  console.log(`Starting generation for ${char.id}...`);
  const previewRes = await requestMeshy("/text-to-3d", "POST", {
    mode: "preview",
    prompt: char.prompt,
    art_style: "realistic"
  });
  const previewId = previewRes.result;
  console.log(`${char.id} - Preview Task ID: ${previewId}`);
  
  while (true) {
    const status = await requestMeshy(`/text-to-3d/${previewId}`, "GET");
    if (status.status === "SUCCEEDED") {
      console.log(`${char.id} - Preview succeeded`);
      break;
    } else if (status.status === "FAILED") {
      throw new Error(`${char.id} - Preview failed: ${status.task_error?.message || 'Unknown'}`);
    }
    await delay(5000);
  }
  
  console.log(`${char.id} - Starting refine task...`);
  const refineRes = await requestMeshy("/text-to-3d", "POST", {
    mode: "refine",
    preview_task_id: previewId
  });
  const refineId = refineRes.result;
  console.log(`${char.id} - Refine Task ID: ${refineId}`);
  
  let glbUrl = null;
  while (true) {
    const status = await requestMeshy(`/text-to-3d/${refineId}`, "GET");
    if (status.status === "SUCCEEDED") {
      glbUrl = status.model_urls.glb;
      console.log(`${char.id} - Refine succeeded`);
      break;
    } else if (status.status === "FAILED") {
      throw new Error(`${char.id} - Refine failed: ${status.task_error?.message || 'Unknown'}`);
    }
    await delay(5000);
  }
  
  console.log(`${char.id} - Downloading GLB from ${glbUrl}...`);
  const modelRes = await fetch(glbUrl);
  const buffer = await modelRes.arrayBuffer();
  
  const targetDir = path.join(process.cwd(), 'public', 'models', 'sleuth');
  await fs.mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, `${char.id}.glb`);
  await fs.writeFile(targetPath, Buffer.from(buffer));
  console.log(`${char.id} - Saved to ${targetPath}`);
}

async function main() {
  const promises = characters.map(char => generateModel(char).catch(e => console.error(`Error for ${char.id}:`, e)));
  await Promise.all(promises);
  console.log("All done!");
}

main();
