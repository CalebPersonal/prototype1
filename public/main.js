// Will need to change this as I move to differant networks

//const apiBase = 'http://192.168.0.133:3000'; // Mag IP
// const apiBase = 'http://172.20.10.11:3000'; // Hotspot IP
const apiBase = 'http://192.168.1.117:3000'; // Hotel IP

const select = document.getElementById('trenchBookSelect');
const imagesContainer = document.getElementById('imagesContainer');
const currentImage = document.getElementById('currentImage');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

let images = [];
let currentIndex = 0;

function showImage(index) {
  if (images.length === 0) return;
  if (index < 0) currentIndex = images.length - 1;
  else if (index >= images.length) currentIndex = 0;
  else currentIndex = index;

  const selected = select.value;
  const filename = images[currentIndex];
  currentImage.src = `${apiBase}/trench-books/${selected}/${filename}`;
  currentImage.alt = filename;
}

prevBtn.addEventListener('click', () => {
  showImage(currentIndex - 1);
});

nextBtn.addEventListener('click', () => {
  showImage(currentIndex + 1);
});

select.addEventListener('change', async (e) => {
  const selected = e.target.value;
  images = [];
  currentIndex = 0;
  currentImage.src = '';
  imagesContainer.innerHTML = ''; // Clear any grid images

  if (!selected) return;

  try {
    // Load the selected book
    const loadRes = await fetch(`${apiBase}/trench-book/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookLabel: selected }),
    });

    if (!loadRes.ok) throw new Error('Failed to load book');
    await loadRes.text();

    // Fetch list of images
    const listRes = await fetch(
      `${apiBase}/trench-book/list-images?bookLabel=${encodeURIComponent(selected)}`
    );
    images = await listRes.json();

    if (images.length === 0) {
      imagesContainer.textContent = 'No images found for this book.';
      currentImage.src = '';
      return;
    }

    // Show first image
    showImage(0);
  } catch (error) {
    console.error('Error:', error);
    imagesContainer.textContent = '⚠️ Failed to load images. Please try again.';
  }
});

// --- Swipe support ---
let touchStartX = 0;
let touchEndX = 0;

currentImage.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
});

currentImage.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleGesture();
});

function handleGesture() {
  if (touchEndX < touchStartX - 30) {
    // Swipe left → next image
    showImage(currentIndex + 1);
  }
  if (touchEndX > touchStartX + 30) {
    // Swipe right → previous image
    showImage(currentIndex - 1);
  }
}