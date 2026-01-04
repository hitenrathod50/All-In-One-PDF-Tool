const { homePage, aboutPage, imageToPDF, imageToPDFDownload, imageToPDFDownloadFile, addPagesToPDF, addPagesToPDFDownload, addPagesToPDFDownloadFile, mergePDF, mergePDFDownload, mergePDFDownloadFile, addPageNumberToPDF, addPageNumberToPDFDownload, addPageNumberToPDFDownloadFile } = require("../controllers/getController");

async function getRoutes(fastify, options) {

  fastify.get("/", homePage);        // Calls homePage controller

  // Image to PDF routes

  fastify.get("/imagetopdf", imageToPDF);
  fastify.get("/imagetopdf/download/:token", imageToPDFDownload);
  fastify.get("/imageToPDF/download/file/:token", imageToPDFDownloadFile);

  // Image to PDF routes

  fastify.get("/add-pages-pdf", addPagesToPDF);
  fastify.get("/add-pages-pdf/download/:token", addPagesToPDFDownload);
  fastify.get("/add-pages-pdf/download/file/:token", addPagesToPDFDownloadFile);

  // Merge PDF
  fastify.get("/merge-pdf", mergePDF);
  fastify.get("/merge-pdf/download/:token", mergePDFDownload);
  fastify.get("/merge-pdf/download/file/:token", mergePDFDownloadFile);

  // Add Page Number to PDF

  fastify.get("/add-page-numbers", addPageNumberToPDF);
  fastify.get("/add-page-numbers/download/:token", addPageNumberToPDFDownload);
  fastify.get("/add-page-numbers/download/file/:token", addPageNumberToPDFDownloadFile);

}

module.exports = getRoutes;
