import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Node.js ES module hack to get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Headers used to identify the client and accept JSON response
const headers = {
  'User-Agent': 'oc-api-client',
  'Accept': 'application/json'
};

// Initial URL to start crawling from
let url = 'https://opencontext.org/media/017ca5a0-3616-4fdc-e70a-837f5dc441b6.json';

// Object to store all results before writing to JSON file
let results = {};

// Counter to track page numbers
let count = 0;

// Main crawling loop: continues while there is a URL to fetch
while (url) {
  console.log(count);
  count++;

  // Fetch the current page JSON data
  const res = await fetch(url, { headers });
  const obj = await res.json();

  /**
   * Extracts and cleans the trench book label from the current JSON object.
   * Removes non-letter/space characters and trailing 'insert'.
   * @returns {string|null} Cleaned label string or null if no label.
   */
  function label_finder() {
    if (typeof obj.label === 'string' && obj.label.trim()) {
      const cleaned = obj.label
        .replace(/[^a-zA-Z ]+/g, '')    // Remove non-letters/spaces
        .replace(/\binsert\b$/i, '')    // Remove trailing "insert"
        .trim();                        // Trim remaining whitespace

      return cleaned.length > 0 ? cleaned : null;
    }
    return null;
  }

  /**
   * Extracts the author initials from the label.
   * Matches initials between 'Trench Book' and Roman numeral.
   * @returns {string|null} Author initials or null if no match.
   */
  function author_finder() {
    if (obj.label) {
      const cleaned = obj.label.replace(/[^a-zA-Z ]+/g, '').trim();
      const match = cleaned.match(/Trench Book\s+([A-Z]+)\s+(I|II|III|IV|V|VI|VII|VIII|IX|X)\b/);
      return match ? match[1] : null;
    }
    return null;
  }

  /**
   * Extracts the year from the linked contexts.
   * Parses a slug to find the 4-digit year.
   * @returns {string|null} Year string or null if not found.
   */
  function year_finder() {
    const ctxs = obj['oc-gen:has-linked-contexts'];
    if (ctxs && ctxs[5]) {
      const raw = ctxs[5].slug;
      const match = raw.match(/\d{2}-(\d{4})-/);
      return match ? match[1] : null;
    }
    return null;
  }

  /**
   * Finds the first JPG image URL from the 'oc-gen:has-files' array.
   * @returns {string|null} JPG URL or null if not found.
   */
  function jpg_finder() {
    const files = obj['oc-gen:has-files'];
    return files && files[0] ? files[0].id : null;
  }

  /**
   * Downloads the JPG image if it does not already exist.
   * Creates the required directories if missing.
   * Saves image as zero-padded count (e.g., 001.jpg).
   * @param {number} count - Current image/page count.
   */
  async function jpg_downloader(count) {
    const jpgUrl = jpg_finder();
    const label = label_finder();
    const safeLabel = label
      .replace(/[^\w\s-]/g, '')   // Remove special characters (keep letters, numbers, space, dash)
      .trim()
      .replace(/\s+/g, '-');
    const folderPath = path.join(__dirname, 'public', 'trench-books', safeLabel);
    const filename = `${String(count).padStart(3, '0')}.jpg`;
    const filePath = path.join(folderPath, filename);

    // Skip download if file already exists to save time
    if (fs.existsSync(filePath)) {
      console.log(`⏭ Skipped (already downloaded)`);
      return;
    }

    // Ensure folder exists
    fs.mkdirSync(folderPath, { recursive: true });

    try {
      const response = await fetch(jpgUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Write image to file
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ Downloaded: ${filePath}`);
    } catch (e) {
      console.log(`❌ Failed to download ${jpgUrl}`);
      console.error(`Error: ${e.message}`);
    }
  }

  /**
   * Builds and updates the in-memory JSON structure with metadata and image paths.
   * @param {number} count - Current image/page count.
   */
  function generate_json_data(count) {
    const label = label_finder();
    const author = author_finder();
    const date = year_finder();
    const safeLabel = label
      .replace(/[^\w\s-]/g, '')   // Remove unwanted characters
      .trim()                     // Trim leading/trailing whitespace
      .replace(/\s+/g, '-'); 
    console.log(safeLabel);
    const folderPath = path.join('trench-books', safeLabel);
    const filename = `${String(count).padStart(3, '0')}.jpg`;
    const filePath = path.join(folderPath, filename);

    if (!results[safeLabel]) {
      results[safeLabel] = {
        author: author,
        date: date,
        'trench-book-images': {
          location: folderPath,
          contents: []
        }
      };
    }

    // Append current image path to contents array
    results[safeLabel]['trench-book-images'].contents.push(filePath);
  }

  // Download the image for current page
  await jpg_downloader(count);

  // Update JSON metadata for current page
  generate_json_data(count);

  // Find the next page URL to continue crawling
  let nextPageUrl = null;
  if (obj['oc-gen:has-obs']) {
    for (const obs of obj['oc-gen:has-obs']) {
      if (obs['oc-pred:1-next']) {
        nextPageUrl = obs['oc-pred:1-next'][0].id;
        if (!nextPageUrl.endsWith('.json')) nextPageUrl += '.json';
        console.log("Next page:", nextPageUrl);
        break;
      }
    }
  } else {
    console.log("Something wrong with JSON formatting. Check book JSON to debug");
  }

  // Stop crawling if no next page URL
  if (nextPageUrl) {
    url = nextPageUrl;
  } else {
    console.log("No next page. Stopping.");
    break;
  }
}

// Path where the final JSON will be saved
const outputFilename = path.join(__dirname, 'OCdata.json');
let existingData = {};

// Load existing JSON data if present to update it
if (fs.existsSync(outputFilename)) {
  console.log(`${outputFilename} already exists. Updating contents...`);
  try {
    const raw = fs.readFileSync(outputFilename, 'utf-8');
    existingData = JSON.parse(raw);
  } catch (e) {
    console.log("Warning: JSON file is empty or corrupted. Starting fresh.");
    existingData = {};
  }
} else {
  console.log(`${outputFilename} does not exist. Creating new file...`);
}

// Merge newly collected results into existing data
Object.assign(existingData, results);

// Write final merged data to file with indentation for readability
fs.writeFileSync(outputFilename, JSON.stringify(existingData, null, 2));
console.log(`Dictionary successfully written to ${outputFilename}`);