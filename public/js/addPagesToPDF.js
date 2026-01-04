/* =============================================================
   PDF + Images to PDF Editor
   - imageArray: [{ originalFile, file (displayed), name, index: visual position, rotation }]
   - Cancel & Rotate for image cards only (now with perfect rotation from original)
   - console.log after every change
   ============================================================= */

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@latest/build/pdf.worker.min.js';

const plusIconImagePicker = document.getElementById('addCardBtn');
const settingsBtn = document.getElementById('settingsBtn');
const drawer = document.getElementById('drawer');
const convertBtn = document.getElementById('convertBtn');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerClose = document.getElementById('drawerClose');
const imageInput = document.getElementById('imageInput');
const cardsContainer = document.getElementById('cardsContainer');

// Global state
let imageArray = [];          // { originalFile: File, file: File (current displayed), name, index, rotation: 0 }
let pdfPageCount = 0;
let pdf = null;               // Stores the selected PDF File object

const state = {
  pageSize: 'fit',
  orientation: 'portrait',
  margin: 'none'
};

plusIconImagePicker.addEventListener('click', () => {
  imageInput.click();
});

/* ---------------------------------------------------------
   Helper: Rotate image by total angle from original → returns new File
   --------------------------------------------------------- */
async function rotateImageFromOriginal(originalFile, totalRotation) {
  const img = new Image();
  const url = URL.createObjectURL(originalFile);
  img.src = url;

  await new Promise(resolve => img.onload = resolve);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Adjust canvas size for 90°/270° rotations
  if (totalRotation === 90 || totalRotation === 270) {
    canvas.width = img.height;
    canvas.height = img.width;
  } else {
    canvas.width = img.width;
    canvas.height = img.height;
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(totalRotation * Math.PI / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  const blob = await new Promise(res => canvas.toBlob(res, originalFile.type || 'image/jpeg', 0.95));
  URL.revokeObjectURL(url);

  return new File([blob], originalFile.name, { type: blob.type });
}

/* ---------------------------------------------------------
   Update card number badges (visual only)
   --------------------------------------------------------- */
function updateCardNumbers() {
  const cards = cardsContainer.querySelectorAll('.card');
  cards.forEach((card, index) => {
    const badge = card.querySelector('.card-number');
    if (badge) {
      badge.textContent = index + 1;
    }
  });
}

/* ---------------------------------------------------------
   Console log current imageArray
   --------------------------------------------------------- */
function logImageArray() {
  console.clear();
  console.log('Current imageArray:', imageArray.map(item => ({
    fileName: item.name,
    index: item.index,
    rotation: item.rotation + '°'
  })));
  if (pdf) {
    console.log('Selected PDF:', pdf, `(${pdfPageCount} pages)`);
  } else {
    console.log('No PDF selected yet.');
  }
}

/* ---------------------------------------------------------
   handleFileSelect – supports PDF + multiple images
   --------------------------------------------------------- */
async function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  event.target.value = '';

  const pdfFile = files.find(f => f.type === 'application/pdf');
  const imageFiles = files.filter(f => f.type.startsWith('image/'));

  if (pdfFile) {
    pdf = pdfFile;
  }

  if (pdfFile) {
    await handlePDFFile(pdfFile);
    if (imageFiles.length) await handleMultipleImageFiles(imageFiles);
  } else if (imageFiles.length) {
    await handleMultipleImageFiles(imageFiles);
  } else {
    alert('Please select at least one PDF or image file.');
  }
}

/* ---------------------------------------------------------
   Handle PDF File – resets everything
   --------------------------------------------------------- */
async function handlePDFFile(file) {
  imageArray = [];
  pdfPageCount = 0;
  cardsContainer.innerHTML = '';

  document.getElementById('pickPDFContainer').classList.add('hidden');
  document.getElementById('addPagesToPDFEnableContainer').classList.remove('hidden');

  state.pageSize = 'fit';
  state.orientation = 'portrait';
  state.margin = 'none';

  syncRadioButtons('pageSize', state.pageSize);
  syncRadioButtons('orientation', state.orientation);
  syncRadioButtons('margin', state.margin);
  updateUI();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    pdfPageCount = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: ctx, viewport }).promise;
      const imgUrl = canvas.toDataURL('image/png');

      const cardId = `card-${pageNum}`;
      const cardHTML = `
        <div class="card pdf-card cursor-not-allowed relative w-full aspect-[3/4] bg-white rounded-lg shadow-md overflow-hidden group opacity-0 transition-opacity duration-500" data-id="${cardId}">
          <img src="${imgUrl}" alt="PDF Page ${pageNum}" class="w-full h-full object-contain">
          <div class="card-number absolute top-2 left-2 bg-[#7100ad] text-white text-xs font-bold flex items-center justify-center w-6 h-6 rounded-full shadow">
            ${pageNum}
          </div>
        </div>`;

      cardsContainer.insertAdjacentHTML('beforeend', cardHTML);
      const newCard = cardsContainer.lastElementChild;
      requestAnimationFrame(() => newCard.style.opacity = '1');
    }

    logImageArray();
  } catch (err) {
    console.error('PDF Error:', err);
    alert('Failed to load PDF.');
    pdf = null;
  }
}

function syncRadioButtons(name, value) {
  document.querySelectorAll(`input[name="${name}"], input[name="${name}Mobile"]`).forEach(radio => {
    radio.checked = radio.value === value;
    const label = radio.nextElementSibling;
    if (radio.checked) {
      label?.classList.add('checked');
    } else {
      label?.classList.remove('checked');
    }
  });
}

function updateUI() {
  const showOrientation = state.pageSize === 'a4' || state.pageSize === 'usletter';
  if (showOrientation) {
    orientationCardDesktop?.classList.remove('hidden');
    orientationCardDesktop?.classList.add('fade-in');
    orientationCardMobile?.classList.remove('hidden');
    orientationCardMobile?.classList.add('fade-in');
  } else {
    orientationCardDesktop?.classList.add('hidden');
    orientationCardMobile?.classList.add('hidden');
  }
}

function initializeRadioListeners() {
  document.querySelectorAll('input[name="pageSize"], input[name="pageSizeMobile"], input[name="orientation"], input[name="orientationMobile"], input[name="margin"], input[name="marginMobile"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const name = e.target.name.replace('Mobile', '');
      state[name] = e.target.value;
      syncRadioButtons(name, state[name]);
      if (name === 'pageSize') updateUI();
    });
  });
}

function getSettings() {
  return {
    pageSize: state.pageSize,
    orientation: state.orientation,
    margin: state.margin
  };
}

window.getPageSettings = getSettings;

/* ---------------------------------------------------------
   Handle Multiple Image Files
   --------------------------------------------------------- */
async function handleMultipleImageFiles(files) {
  const startIndex = cardsContainer.children.length + 1;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const visualIndex = startIndex + i;

    const imageObj = {
      originalFile: file,           // ← unchanged original
      file: file,                   // ← current displayed file (initially same)
      name: file.name,
      index: visualIndex,
      rotation: 0
    };
    imageArray.push(imageObj);

    const imgUrl = URL.createObjectURL(file);
    const cardId = `image-card-${visualIndex}`;

    const cardHTML = `
      <div class="card image-card cursor-move relative w-full aspect-[3/4] bg-white rounded-lg shadow-md overflow-hidden group opacity-0 transition-opacity duration-500" data-id="${cardId}" data-index="${visualIndex}">
        <img src="${imgUrl}" alt="Image ${visualIndex}" class="w-full h-full object-contain">
        <div class="card-number absolute top-2 left-2 bg-[#7100ad] text-white text-xs font-bold flex items-center justify-center w-6 h-6 rounded-full shadow">
          ${visualIndex}
        </div>

        <button class="cancel-btn absolute top-2 right-2 bg-white rounded-full p-1 shadow-sm opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#7100ad]">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#7100ad]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        
      </div>`;

      // image rotation button
      // <button class="rotate-btn absolute bottom-2 right-2 bg-[#7100ad] rounded-full p-1 shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-[#5a008a] focus:outline-none focus:ring-2 focus:ring-[#7100ad]">
      //     <svg fill="#ffffff" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 486.805 486.805" class="h-3.5 w-3.5" transform="matrix(-1,0,0,1,0,0)rotate(180)">
      //       <path d="M261.397,17.983c-88.909,0-167.372,51.302-203.909,129.073L32.072,94.282L0,109.73l52.783,109.565l109.565-52.786l-15.451-32.066L89.82,161.934c30.833-65.308,96.818-108.353,171.577-108.353c104.668,0,189.818,85.154,189.818,189.821s-85.15,189.824-189.818,189.824c-61.631,0-119.663-30.109-155.228-80.539l-29.096,20.521c42.241,59.87,111.143,95.613,184.324,95.613c124.286,0,225.407-101.122,225.407-225.419S385.684,17.983,261.397,17.983z"></path>
      //     </svg>
      //   </button>

    cardsContainer.insertAdjacentHTML('beforeend', cardHTML);
    const newCard = cardsContainer.lastElementChild;
    requestAnimationFrame(() => newCard.style.opacity = '1');
  }

  updateCardNumbers();
  logImageArray();
}

/* ---------------------------------------------------------
   Touch device detection
   --------------------------------------------------------- */
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
if (isTouchDevice()) {
  cardsContainer.addEventListener('contextmenu', e => {
    if (e.target.tagName === 'IMG') e.preventDefault();
  });
}

/* ---------------------------------------------------------
   Sortable – PDF cards are filtered
   --------------------------------------------------------- */
new Sortable(cardsContainer, {
  animation: 300,
  ghostClass: 'sortable-ghost',
  chosenClass: 'sortable-chosen',
  dragClass: 'sortable-drag',
  easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  swapThreshold: 0.65,
  fallbackTolerance: 3,
  forceFallback: false,
  scroll: true,
  delay: isTouchDevice() ? 200 : 0,
  delayOnTouchOnly: true,
  filter: '.pdf-card',
  onSort: () => {
    const cards = cardsContainer.querySelectorAll('.card');
    const newImageArray = [];

    cards.forEach((card, visualIndex) => {
      const pos = visualIndex + 1;

      if (card.classList.contains('image-card')) {
        const oldEntry = imageArray.find(item =>
          `image-card-${item.index}` === card.dataset.id
        );
        if (oldEntry) {
          oldEntry.index = pos;
          newImageArray.push(oldEntry);
          card.dataset.id = `image-card-${pos}`;
          card.dataset.index = pos;
        }
      }
    });

    imageArray = newImageArray;
    updateCardNumbers();
    logImageArray();
  }
});

/* ---------------------------------------------------------
   handleConvert – Sends original PDF + rotated images
   --------------------------------------------------------- */
async function handleConvert() {
  if (!pdf) {
    alert('No PDF file selected!');
    return;
  }

  const spinnerContainer = document.createElement('div');
  spinnerContainer.id = 'spinnerContainer';
  spinnerContainer.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50';
  spinnerContainer.innerHTML = `
    <div role="status">
      <svg aria-hidden="true" class="inline w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-purple-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
        <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
      </svg>
      <span class="sr-only">Loading...</span>
    </div>
  `;
  document.body.appendChild(spinnerContainer);

  const settings = {
    pageSize: state.pageSize,
    orientation: state.orientation,
    margin: state.margin
  };

  if (typeof closeDrawer === 'function') closeDrawer();

  const formData = new FormData();

  try {
    formData.append('pdf', pdf);

    const compressedResults = await Promise.all(
      imageArray.map(async (item) => {
        return new Promise((resolve, reject) => {
          new Compressor(item.file, {
            quality: 0.4,
            success(compressedBlob) {
              const compressedFile = new File([compressedBlob], item.name, { type: compressedBlob.type });
              resolve({
                index: item.index,
                file: compressedFile,
                rotation: item.rotation
              });
            },
            error(err) {
              console.error(`Compression failed for image ${item.name}:`, err);
              reject(err);
            }
          });
        });
      })
    );

    compressedResults.forEach((result, arrayIndex) => {
      formData.append(`images[${arrayIndex}][file]`, result.file);
      formData.append(`images[${arrayIndex}][index]`, result.index);
      formData.append(`images[${arrayIndex}][rotation]`, result.rotation);
    });

    formData.append('settings', JSON.stringify(state));

    const response = await fetch('/addPagesToPDF', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    if (response.redirected) {
      window.location.href = response.url;
    }

  } catch (error) {
    console.error('Add Pages failed:', error);
    const spinner = document.getElementById('spinnerContainer');
    if (spinner) spinner.remove();
    alert('Failed to add pages to PDF. Please try again.');
  }
}

convertBtn?.addEventListener('click', handleConvert);

/* ---------------------------------------------------------
   Drawer Controls
   --------------------------------------------------------- */
function openDrawer() {
  drawer.classList.remove('translate-x-full');
  drawer.classList.add('translate-x-0');
  drawerOverlay.classList.remove('opacity-0', 'invisible');
  drawerOverlay.classList.add('opacity-100', 'visible');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  drawer.classList.add('translate-x-full');
  drawer.classList.remove('translate-x-0');
  drawerOverlay.classList.add('opacity-0', 'invisible');
  drawerOverlay.classList.remove('opacity-100', 'visible');
  document.body.style.overflow = '';
}
settingsBtn?.addEventListener('click', openDrawer);
drawerClose?.addEventListener('click', closeDrawer);
drawerOverlay?.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && drawer.classList.contains('translate-x-0')) closeDrawer();
});
drawer?.addEventListener('click', e => e.stopPropagation());

/* ---------------------------------------------------------
   Cancel & Rotate – Event Delegation (NOW with perfect rotation)
   --------------------------------------------------------- */
cardsContainer.addEventListener('click', async e => {
  const cancelBtn = e.target.closest('.cancel-btn');
  const rotateBtn = e.target.closest('.rotate-btn');

  if (cancelBtn) {
    const card = cancelBtn.closest('.card');
    if (!card || card.classList.contains('pdf-card')) return;

    const cardId = card.dataset.id;
    const img = card.querySelector('img');
    if (img && img.src.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }

    card.style.transition = 'opacity 0.3s ease';
    card.style.opacity = '0';

    setTimeout(() => {
      card.remove();
      imageArray = imageArray.filter(item => `image-card-${item.index}` !== cardId);
      updateCardNumbersAfterDelete();
      logImageArray();
    }, 300);
    return;
  }

  if (rotateBtn) {
    const card = rotateBtn.closest('.card');
    if (!card || card.classList.contains('pdf-card')) return;

    const cardId = card.dataset.id;
    const img = card.querySelector('img');
    const entry = imageArray.find(o => `image-card-${o.index}` === cardId);
    if (!entry || !img) return;

    // Update total rotation
    entry.rotation = (entry.rotation + 90) % 360;

    // Revoke old blob
    if (img.src.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }

    // Generate new rotated version from ORIGINAL file
    const rotatedFile = await rotateImageFromOriginal(entry.originalFile, entry.rotation);
    entry.file = rotatedFile; // update displayed file
    img.src = URL.createObjectURL(rotatedFile);

    logImageArray();
  }
});

function updateCardNumbersAfterDelete() {
  const cards = cardsContainer.querySelectorAll('.card');
  let visualPos = 1;

  cards.forEach(card => {
    const badge = card.querySelector('.card-number');
    if (badge) badge.textContent = visualPos;

    if (card.classList.contains('image-card')) {
      const oldIndex = parseInt(card.dataset.index);
      const entry = imageArray.find(e => e.index === oldIndex);
      if (entry) {
        entry.index = visualPos;
        card.dataset.id = `image-card-${visualPos}`;
        card.dataset.index = visualPos;
      }
    }
    visualPos++;
  });
}

imageInput.addEventListener('change', handleFileSelect);

document.addEventListener('DOMContentLoaded', () => {
  initializeRadioListeners();
  updateUI();
  console.log('Image to PDF Converter initialized');
  console.log('Current settings:', getSettings());
});