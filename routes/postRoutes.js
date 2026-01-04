const { imageToPDFPOST, addPagestoPDFPOST, mergePDFPost, addPageNumberToPDF, addPageNumberToPDFPost } = require("../controllers/postController");

async function postRoutes(fastify, options) {

  fastify.post("/imageToPDFPost", imageToPDFPOST);

  fastify.post("/addPagesToPDF", addPagestoPDFPOST);

  fastify.post("/mergePDFPost", mergePDFPost);

  fastify.post("/addPageNumberToPDFPost", addPageNumberToPDFPost);

}

module.exports = postRoutes;
