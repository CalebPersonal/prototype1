const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');

// Starting URL
let url = 'https://opencontext.org/media/6ee89e00-d436-440e-6a8c-d488a1776991.json';

// Headers
const headers = {
  'User-Agent': 'oc-api-client',
  'Accept': 'application/json',
};

let count = 0;
const results = {};
const visitedUrls = new Set();

function labelFinder(label) {
  if (typeof label !== 'string' || !label.trim()) return null;

  let cleaned = label.replace(/[^a-zA-Z0-9 :,-]+/g, '');
  cleaned = cleaned.replace(/,?\s*insert\s*\d*$/i, '');
  cleaned = cleaned.replace(/:\d+(-\d+)?$/, '');
  cleaned = cleaned.trim();
  return cleaned || null;
}

function authorFinder(label) {
  if (!label) return null;
  const cleaned = label.replace(/[^a-zA-Z ]+/g, '').trim();
  const match = cleaned.match(/Trench Book\s+([A-Z]+)\s+(I|II|III|IV|V|VI|VII|VIII|IX|X)\b/);
  return match ? match[1] : null;
}

function yearFinder(obj) {
  const ctxs = obj['oc-gen:has-linked-contexts'] || [];
  if (ctxs.length > 5) {
    const raw = ctxs[5]?.slug || '';
    const match = raw.match(/\d{2}-(\d{4})-/);
    return match ? match[1] : null;
  }
  return null;
}

function jpgFinder(obj) {
  const files = obj['oc-gen:has-files'] || [];
  return files[0]?.id || null;
}

async function jpgDownloader(obj, count, baseDir) {
  const jpgUrl = jpgFinder(obj);
  const label = labelFinder(obj.label);
  if (!jpgUrl || !label) return;

  const safeLabel = label.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  const folderPath = path.join(baseDir, 'public', 'trench-books', safeLabel);
  const filename = `${String(count).padStart(3, '0')}.jpg`;
  const filePath = path.join(folderPath, filename);

  try {
    await fs.mkdir(folderPath, { recursive: true });
    await fs.access(filePath);
    console.log("⏭ Skipped (already downloaded)");
  } catch {
    try {
      const response = await axios.get(jpgUrl, { responseType: 'arraybuffer', headers });
      await fs.writeFile(filePath, response.data);
      console.log(`✅ Downloaded: ${filePath}`);
    } catch (err) {
      console.error(`❌ Failed to download ${jpgUrl}`, err.message);
    }
  }
}

function generateJsonData(obj, count, results) {
  const label = labelFinder(obj.label);
  const author = authorFinder(obj.label);
  const date = yearFinder(obj);

  if (!label) return;

  const safeLabel = label.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  const folderPath = path.join('trench-books', safeLabel);
  const filename = `${String(count).padStart(3, '0')}.jpg`;
  const filePath = path.join(folderPath, filename);

  if (!results[safeLabel]) {
    results[safeLabel] = {
      author,
      date,
      'trench-book-images': {
        location: folderPath,
        contents: []
      }
    };
  }
  results[safeLabel]['trench-book-images']['contents'].push(filePath);
}

async function main() {
  const baseDir = __dirname;
  const outputFilename = path.join(baseDir, 'OCdata.json');
  let existingData = {};

  while (url) {
    if (visitedUrls.has(url)) {
      console.log(`🔁 Already visited ${url}, stopping to avoid infinite loop.`);
      break;
    }
    visitedUrls.add(url);

    console.log(count);
    count += 1;

    try {
      const response = await axios.get(url, { headers });
      const obj = response.data;

      await jpgDownloader(obj, count, baseDir);
      generateJsonData(obj, count, results);

      let nextPageUrl = null;
      const obsList = obj['oc-gen:has-obs'] || [];

      const nexts = obsList.flatMap(obs => obs['oc-pred:1-next'] || []);

      for (const next of nexts) {
        let candidate = next.id;
        if (candidate && !candidate.endsWith('.json')) {
          candidate += '.json';
        }
        if (candidate !== url && !visitedUrls.has(candidate)) {
          nextPageUrl = candidate;
          console.log("Next page:", nextPageUrl);
          break;
        }
      }

      if (!nextPageUrl) {
        console.log("🛑 No next unvisited page. Stopping.");
        break;
      }

      url = nextPageUrl;
    } catch (err) {
      console.error("Error fetching page:", err.message);
      break;
    }
  }

  // Save JSON
  try {
    try {
      const data = await fs.readFile(outputFilename, 'utf-8');
      existingData = JSON.parse(data);
      console.log(`${outputFilename} already exists. Updating contents...`);
    } catch {
      console.log(`${outputFilename} does not exist. Creating new file...`);
    }

    Object.assign(existingData, results);
    await fs.writeFile(outputFilename, JSON.stringify(existingData, null, 2));
    console.log(`📄 Dictionary successfully written to ${outputFilename}`);
  } catch (err) {
    console.error("Failed to write JSON:", err.message);
  }
}

main();