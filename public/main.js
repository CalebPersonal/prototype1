// Will need to change this as I move to differant networks

const apiBase = 'http://192.168.0.133:3000'; // Mag IP
// const apiBase = 'http://172.20.10.11:3000'; // Hotspot IP
// const apiBase = 'http://192.168.1.117:3000'; // Hotel IP
// const apiBase = 'https://sweet-cobras-sit.loca.lt'; // Ngrok URL
// const apiBase = 'https://192.168.0.54:3000'; // Portable IP


const select = document.getElementById('trenchBookSelect');
const imagesContainer = document.getElementById('imagesContainer');
const currentImage = document.getElementById('currentImage');

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
// Add reference to the slider (will be added to HTML)
const pageSlider = document.getElementById('pageSlider');

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

  // Update slider position
  if (images.length > 0 && pageSlider) {
    pageSlider.value = currentIndex + 1;
  }
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
  // Show default image when no book is selected
  currentImage.src = 'images/default.jpg';
  currentImage.alt = 'No book selected';
  imagesContainer.innerHTML = '';
  if (pageSlider) {
    pageSlider.disabled = true;
    pageSlider.value = 1;
    pageSlider.max = 1;
  }

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
      if (pageSlider) {
        pageSlider.disabled = true;
        pageSlider.value = 1;
        pageSlider.max = 1;
      }
      return;
    }

    // Enable and set up the slider
    if (pageSlider) {
      pageSlider.max = images.length;
      pageSlider.value = 1;
      pageSlider.disabled = false;
      // Remove previous event listener if any
      pageSlider.oninput = null;
      // Attach event listener for slider navigation
      pageSlider.addEventListener('input', (e) => {
        const idx = parseInt(e.target.value, 10) - 1;
        showImage(idx);
      });
    }
    // Show first image
    showImage(0);
  } catch (error) {
    console.error('Error:', error);
    imagesContainer.textContent = '⚠️ Failed to load images. Please try again.';
    if (pageSlider) {
      pageSlider.disabled = true;
      pageSlider.value = 1;
      pageSlider.max = 1;
    }
  }
});


// --- Fullscreen support ---
// Add fullscreen functionality to the image viewer
document.addEventListener('DOMContentLoaded', () => {
  const imageViewer = document.getElementById('imageViewer');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      imageViewer.requestFullscreen().catch(err => {
        console.error(`Error attempting to enter fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });
});



// --- Book info display ---
// Populate trench info table based on selected book
const infoTitle = document.getElementById('infoTitle');
const infoAuthor = document.getElementById('infoAuthor');
const infoDate = document.getElementById('infoDate');
const infoCoords = document.getElementById('infoCoords');

select.addEventListener('change', async (e) => {
  fetch('OCdata.json')
    .then(response => response.json())
    .then(data => {
      const selectedLabel = select.value;
      const selectedBook = data[selectedLabel];

      if (selectedBook) {
        infoTitle.textContent = selectedBook.trenchName || '-';
        infoAuthor.textContent = selectedBook.author || '-';
        infoDate.textContent = selectedBook.date || '-';
        infoCoords.textContent = selectedBook.coordinates ? selectedBook.coordinates.join(', ') : '-';
      } else {
        infoTitle.textContent = '-';
        infoAuthor.textContent = '-';
        infoDate.textContent = '-';
        infoCoords.textContent = '-';
      }
    })
    .catch(error => {
      infoTitle.textContent = '-';
      infoAuthor.textContent = '-';
      infoDate.textContent = '-';
      infoCoords.textContent = '-';
      console.error('Error loading JSON:', error);
    });
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
