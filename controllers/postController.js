const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const sharp = require('sharp');
const crypto = require('crypto');
// const { type } = require('os');
const pdfStorage = new Map();

// Helper to convert PDF page size to points
const pageSizes = {
    A4: [595.28, 841.89],
    LETTER: [612, 792],
    FIT: null
};

// Margin settings in millimeters converted to points (1mm = 2.83465 points)
const marginSizes = {
    none: 0,
    small: 10 * 2.83465, // 10mm = 28.3465 points
    big: 20 * 2.83465    // 20mm = 56.693 points
};

async function imageToPDFPOST(request, reply) {
    try {
        const parts = await request.parts();

        const images = [];
        let settings = {};

        // -------- Parse multipart data --------
        for await (const part of parts) {
            if (part.file) {
                const buffer = await part.toBuffer();
                const match = part.fieldname.match(/images\[(\d+)\]\[file\]/);

                if (match) {
                    const index = Number(match[1]);
                    images[index] ??= {};
                    images[index].file = buffer;
                    images[index].filename = part.filename;
                }
            } else {
                if (part.fieldname.startsWith('images[')) {
                    const match = part.fieldname.match(/images\[(\d+)\]\[(\w+)\]/);
                    if (match) {
                        const index = Number(match[1]);
                        const key = match[2];
                        images[index] ??= {};
                        images[index][key] = part.value;
                    }
                } else if (part.fieldname === 'settings') {
                    settings = JSON.parse(part.value);
                }
            }
        }

        // -------- Validation --------
        if (!images.length) {
            return reply.status(400).send({ error: 'No images provided' });
        }

        if (!settings.pageSize || !settings.margin || !settings.orientation) {
            return reply.status(400).send({ error: 'Invalid settings' });
        }

        if (!['none', 'small', 'big'].includes(settings.margin)) {
            return reply.status(400).send({ error: 'Invalid margin value' });
        }

        const dpi = settings.dpi ? parseInt(settings.dpi) : 300;
        const margin = marginSizes[settings.margin] || 0;

        // -------- Create PDF --------
        const pdfDoc = await PDFDocument.create();

        // -------- Process images in parallel --------
        await Promise.all(
            images.map(async (img) => {
                if (!img?.file || img.rotation === undefined) return;

                // Rotate & compress image
                const processedImage = await sharp(img.file)
                    .rotate(Number(img.rotation) || 0)
                    .jpeg({ quality: 85 })
                    .toBuffer();

                const pdfImage = await pdfDoc.embedJpg(processedImage);
                const { width, height } = pdfImage;

                const imgWidthPt = (width / dpi) * 72;
                const imgHeightPt = (height / dpi) * 72;

                let pageWidth, pageHeight;

                if (settings.pageSize.toUpperCase() === 'FIT') {
                    pageWidth = imgWidthPt + margin * 2;
                    pageHeight = imgHeightPt + margin * 2;
                } else {
                    const pageSize =
                        pageSizes[settings.pageSize.toUpperCase()] || pageSizes.A4;

                    [pageWidth, pageHeight] =
                        settings.orientation === 'landscape'
                            ? [pageSize[1], pageSize[0]]
                            : pageSize;
                }

                const contentWidth = pageWidth - margin * 2;
                const contentHeight = pageHeight - margin * 2;

                const scale =
                    settings.pageSize.toUpperCase() === 'FIT'
                        ? 1
                        : Math.min(
                              contentWidth / imgWidthPt,
                              contentHeight / imgHeightPt
                          );

                const drawWidth = imgWidthPt * scale;
                const drawHeight = imgHeightPt * scale;

                const x = margin + (contentWidth - drawWidth) / 2;
                const y = margin + (contentHeight - drawHeight) / 2;

                const page = pdfDoc.addPage([pageWidth, pageHeight]);
                page.drawImage(pdfImage, {
                    x,
                    y,
                    width: drawWidth,
                    height: drawHeight,
                });
            })
        );

        // -------- Save PDF --------
        const pdfBytes = await pdfDoc.save();

        // -------- Store PDF --------
        const token = crypto.randomBytes(32).toString('hex');
        pdfStorage.set(token, Buffer.from(pdfBytes));

        return reply.redirect(`/imagetopdf/download/${token}`);

    } catch (err) {
        request.log.error(err);
        return reply
            .status(500)
            .send({ error: 'Internal Server Error', message: err.message });
    }
}

async function addPagestoPDFPOST(request, reply) {
    try {
        const data = await request.parts();

        let originalPdfBuffer = null;
        const imageEntries = []; // Will store { index, file, filename, rotation }
        let settings = {};

        // ====================================================
        // Parse multipart form-data
        // ====================================================
        for await (const part of data) {
            if (part.file) {
                if (part.fieldname === "pdf") {
                    originalPdfBuffer = await part.toBuffer();
                } else {
                    const buffer = await part.toBuffer();
                    const match = part.fieldname.match(/images\[(\d+)\]\[file\]/);
                    if (match) {
                        const idx = parseInt(match[1]);
                        if (!imageEntries[idx]) imageEntries[idx] = {};
                        imageEntries[idx].file = buffer;
                        imageEntries[idx].filename = part.filename;
                        imageEntries[idx].rawIndex = idx; // preserve original order
                    }
                }
            } else {
                if (part.fieldname.startsWith("images[")) {
                    const match = part.fieldname.match(/images\[(\d+)\]\[(\w+)\]/);
                    if (match) {
                        const idx = parseInt(match[1]);
                        const key = match[2];
                        if (!imageEntries[idx]) imageEntries[idx] = {};
                        imageEntries[idx][key] = part.value;
                    }
                } else if (part.fieldname === "settings") {
                    try {
                        settings = JSON.parse(part.value);
                    } catch (e) {
                        return reply.status(400).send({ error: "Invalid settings JSON" });
                    }
                }
            }
        }

        // Validation
        if (!originalPdfBuffer) {
            return reply.status(400).send({ error: "Original PDF not provided" });
        }

        const validImages = imageEntries
            .map((entry, i) => entry && entry.file && entry.index !== undefined ? { ...entry, originalOrder: i } : null)
            .filter(Boolean);

        if (validImages.length === 0) {
            return reply.status(400).send({ error: "No valid images with index provided" });
        }

        // Validate settings
        if (!settings.pageSize || !settings.margin || !settings.orientation) {
            return reply.status(400).send({ error: "Missing required settings: pageSize, margin, orientation" });
        }
        if (!['none', 'small', 'big'].includes(settings.margin)) {
            return reply.status(400).send({ error: "Invalid margin value" });
        }

        settings.dpi = settings.dpi ? parseInt(settings.dpi) : 300;

        // ====================================================
        // Load original PDF
        // ====================================================
        const pdfDoc = await PDFDocument.load(originalPdfBuffer);
        const totalPages = pdfDoc.getPageCount();

        const margin = marginSizes[settings.margin] || 0;

        // ====================================================
        // Pre-process all images in PARALLEL (fast!)
        // ====================================================
        const processedImages = await Promise.all(
            validImages.map(async (img) => {
                let buffer = img.file;

                const rotation = parseFloat(img.rotation) || 0;

                // Only use sharp if rotation needed OR not already JPEG
                if (rotation !== 0 || !img.filename?.toLowerCase().endsWith('.jpg') && !img.filename?.toLowerCase().endsWith('.jpeg')) {
                    buffer = await sharp(img.file)
                        .rotate(rotation)
                        .jpeg({ quality: 95 }) // high quality, smaller than PNG
                        .toBuffer();
                }

                const embedded = await pdfDoc.embedJpg(buffer);
                const { width: imgW, height: imgH } = embedded;

                // Calculate dimensions in points
                const imgWpts = (imgW / settings.dpi) * 72;
                const imgHpts = (imgH / settings.dpi) * 72;

                let pageWidth, pageHeight;
                let scaledW, scaledH, x, y;

                if (settings.pageSize.toUpperCase() === "FIT") {
                    pageWidth = imgWpts + 2 * margin;
                    pageHeight = imgHpts + 2 * margin;
                    scaledW = imgWpts;
                    scaledH = imgHpts;
                    x = margin;
                    y = margin;
                } else {
                    const base = pageSizes[settings.pageSize.toUpperCase()] || pageSizes.A4;
                    [pageWidth, pageHeight] = settings.orientation === "landscape" ? [base[1], base[0]] : base;

                    const contentW = pageWidth - 2 * margin;
                    const contentH = pageHeight - 2 * margin;

                    const scale = Math.min(contentW / imgWpts, contentH / imgHpts);
                    scaledW = imgWpts * scale;
                    scaledH = imgHpts * scale;

                    x = margin + (contentW - scaledW) / 2;
                    y = margin + (contentH - scaledH) / 2;
                }

                // Convert 1-based index to 0-based, clamp
                let insertAt = Number(img.index) - 1;
                insertAt = Math.max(0, Math.min(insertAt, totalPages + validImages.length)); // allow append

                return {
                    embedded,
                    pageSize: [pageWidth, pageHeight],
                    drawOptions: { x, y, width: scaledW, height: scaledH },
                    insertAt, // final insertion position (will adjust later)
                    originalIndex: Number(img.index)
                };
            })
        );

        // ====================================================
        // Sort by insertion index DESCENDING (to avoid index shifting)
        // ====================================================
        processedImages.sort((a, b) => b.insertAt - a.insertAt);

        // Insert pages from end to beginning
        for (const imgData of processedImages) {
            // Recalculate correct insertion point due to previous insertions
            const currentTotal = pdfDoc.getPageCount();
            let insertPos = imgData.insertAt;

            // Adjust for previously inserted pages before this position
            const insertedBefore = processedImages.filter(p => p !== imgData && p.insertAt <= insertPos).length;
            insertPos += insertedBefore;

            // Final clamp
            insertPos = Math.min(insertPos, currentTotal);

            const page = pdfDoc.insertPage(insertPos, imgData.pageSize);
            page.drawImage(imgData.embedded, imgData.drawOptions);
        }

        // ====================================================
        // Save and return
        // ====================================================
        const pdfBytes = await pdfDoc.save({ useObjectStreams: true }); // slightly faster

        if (!pdfBytes || pdfBytes.length === 0) {
            return reply.status(500).send({ error: "Failed to generate PDF" });
        }

        const token = crypto.randomBytes(32).toString('hex');
        pdfStorage.set(token, Buffer.from(pdfBytes));

        return reply.redirect(`/add-pages-pdf/download/${token}`);

    } catch (error) {
        fastify.log.error("Add Pages to PDF Error:", error);
        return reply.status(500).send({
            error: "Internal server error",
            message: error.message
        });
    }
}

async function mergePDFPost(request, reply) {
  try {
    const data = await request.parts();

    const pdfs = [];
    let settings = { margin: 'none' };

    // Parse multipart data
    for await (const part of data) {
      if (part.file) {
        const buffer = await part.toBuffer();
        const match = part.fieldname.match(/^pdfs\[(\d+)\]$/);

        if (match) {
          const index = parseInt(match[1], 10);
          pdfs[index] = {
            file: buffer,
            filename: part.filename || `pdf_${index}.pdf`,
          };
        }
      } else if (part.fieldname === 'settings') {
        try {
          const parsed = JSON.parse(part.value);
          if (['none', 'small', 'big'].includes(parsed.margin)) {
            settings.margin = parsed.margin;
          }
        } catch {
          return reply.status(400).send({ error: 'Invalid settings JSON' });
        }
      }
    }

    // Filter valid PDFs
    const validPdfs = pdfs.filter(p => p && p.file);
    if (validPdfs.length === 0) {
      return reply.status(400).send({ error: 'No PDFs provided' });
    }

    // Create merged PDF
    const mergedPdf = await PDFDocument.create();
    const margin = marginSizes[settings.margin];

    for (const pdfItem of validPdfs) {
      const srcPdf = await PDFDocument.load(pdfItem.file);

      for (let i = 0; i < srcPdf.getPageCount(); i++) {
        const [embeddedPage] = await mergedPdf.embedPages([
          srcPdf.getPage(i),
        ]);

        const { width, height } = embeddedPage;

        const newPage = mergedPdf.addPage([
          width + margin * 2,
          height + margin * 2,
        ]);

        newPage.drawPage(embeddedPage, {
          x: margin,
          y: margin,
          width,
          height,
        });
      }
    }

    // Save merged PDF
    const pdfBytes = await mergedPdf.save();

    // Token for download
    const token = crypto.randomBytes(32).toString('hex');

    // Store PDF (same pattern as image-to-pdf)
    pdfStorage.set(token, Buffer.from(pdfBytes));

    return reply.redirect(`/merge-pdf/download/${token}`);

  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

function toRoman(num) {
    if (num < 1) return "";
    const roman = [
        ["M", 1000], ["CM", 900], ["D", 500], ["CD", 400],
        ["C", 100], ["XC", 90], ["L", 50], ["XL", 40],
        ["X", 10], ["IX", 9], ["V", 5], ["IV", 4], ["I", 1]
    ];

    let result = "";
    for (const [r, v] of roman) {
        while (num >= v) {
            result += r;
            num -= v;
        }
    }
    return result;
}

async function addPageNumberToPDFPost(request, reply) {
    try {
        const parts = await request.parts();

        let pdfBuffer;
        let settings = {};

        // -------- Parse multipart data --------
        for await (const part of parts) {
            if (part.file && part.fieldname === "pdf") {
                pdfBuffer = await part.toBuffer();
            } else if (part.fieldname === "settings") {
                settings = JSON.parse(part.value);
            }
        }

        // -------- Validation --------
        if (!pdfBuffer) {
            return reply.status(400).send({ error: "No PDF file provided" });
        }

        if (!settings.pageSize || !settings.margin || !settings.orientation) {
            return reply.status(400).send({ error: "Invalid settings" });
        }

        if (!["none", "small", "big"].includes(settings.margin)) {
            return reply.status(400).send({ error: "Invalid margin value" });
        }

        const state = {
            pageNumberFormat: settings.pageNumberFormat ?? "arabic",
            position: settings.position ?? "bottom-center",
            pageNumberStart: Math.max(parseInt(settings.pageNumberStart) || 1, 1),
            margin: settings.margin,
            pageSize: settings.pageSize.toUpperCase(),
            orientation: settings.orientation.toLowerCase(),
        };

        if (!pageSizes[state.pageSize]) {
            state.pageSize = "FIT";
        }

        const margin = marginSizes[state.margin] || 0;

        // -------- Load source PDF --------
        const srcDoc = await PDFDocument.load(pdfBuffer);
        const srcPages = srcDoc.getPages();
        const totalPages = srcPages.length;

        // -------- Create output PDF --------
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 10;

        const formatPageNumber = (index) => {
            const num = state.pageNumberStart + index;
            switch (state.pageNumberFormat) {
                case "roman":
                    return toRoman(num);
                case "page-n":
                    return `Page ${num}`;
                case "page-n-of-m":
                    return `Page ${num} of ${totalPages}`;
                case "n-slash-m":
                    return `${num} / ${totalPages}`;
                default:
                    return String(num);
            }
        };

        // -------- Process pages --------
        for (let i = 0; i < srcPages.length; i++) {
            const srcPage = srcPages[i];
            const [embeddedPage] = await pdfDoc.embedPages([srcPage]);

            const srcWidth = srcPage.getWidth();
            const srcHeight = srcPage.getHeight();

            let pageWidth, pageHeight;

            if (state.pageSize === "FIT") {
                pageWidth = srcWidth + margin * 2;
                pageHeight = srcHeight + margin * 2;
            } else {
                [pageWidth, pageHeight] = pageSizes[state.pageSize];
                if (state.orientation === "landscape") {
                    [pageWidth, pageHeight] = [pageHeight, pageWidth];
                }
            }

            // ✅ SAME LOGIC AS imageToPDFPOST
            const contentWidth = pageWidth - margin * 2;
            const contentHeight = pageHeight - margin * 2;

            const scale =
                state.pageSize === "FIT"
                    ? 1
                    : Math.min(
                          contentWidth / srcWidth,
                          contentHeight / srcHeight
                      );

            const drawWidth = srcWidth * scale;
            const drawHeight = srcHeight * scale;

            const x = margin + (contentWidth - drawWidth) / 2;
            const y = margin + (contentHeight - drawHeight) / 2;

            const page = pdfDoc.addPage([pageWidth, pageHeight]);

            page.drawPage(embeddedPage, {
                x,
                y,
                width: drawWidth,
                height: drawHeight,
            });

            // -------- Page number --------
            const text = formatPageNumber(i);
            const textWidth = font.widthOfTextAtSize(text, fontSize);

            const isTop = state.position.startsWith("top");
            const isCenter = state.position.endsWith("center");
            const isLeft = state.position.endsWith("left");

            const textX = isCenter
                ? (pageWidth - textWidth) / 2
                : isLeft
                ? margin
                : pageWidth - margin - textWidth;

            const textY = isTop
                ? pageHeight - margin - fontSize
                : margin;

            page.drawText(text, {
                x: textX,
                y: textY,
                size: fontSize,
                font,
                color: rgb(0.2, 0.2, 0.2),
            });
        }

        // -------- Save PDF --------
        const pdfBytes = await pdfDoc.save({ useObjectStreams: true });

        // -------- Store PDF --------
        const token = crypto.randomBytes(32).toString("hex");
        pdfStorage.set(token, Buffer.from(pdfBytes));

        return reply.redirect(`/add-page-numbers/download/${token}`);

    } catch (err) {
        request.log.error(err);
        return reply
            .status(500)
            .send({ error: "Internal Server Error", message: err.message });
    }
}



module.exports = {
    imageToPDFPOST,
    pdfStorage,
    addPagestoPDFPOST,
    mergePDFPost,
    addPageNumberToPDFPost
};