// Controller functions for GET routes

const { pdfStorage } = require("./postController");

async function homePage(request, reply) {
  return reply.view("pages/index.ejs");
}

async function imageToPDF(request, reply) {
  return reply.view("pages/imageToPDF.ejs");
}

async function imageToPDFDownload(request, reply) {

  try {
    const { token } = request.params;
    const endPoint = "imageToPDF";

    // Validate token
    if (!token || !pdfStorage.has(token)) {
      return reply.redirect('/imagetopdf');
    }

    // Render the downloadPDF.ejs view with the token
    return reply.view('pages/downloadPDF.ejs', { token, endPoint, title : "Image to PDF" });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error', message: error.message });
  }

}

async function imageToPDFDownloadFile(request, reply) {

  try {
    const { token } = request.params;

    // Validate token
    if (!token || !pdfStorage.has(token)) {
      return reply.status(400).send({ error: 'Invalid or expired token' });
    }

    // Retrieve PDF buffer
    const pdfBuffer = pdfStorage.get(token);

    // Delete the PDF from storage after retrieval
    pdfStorage.delete(token);

    // Send PDF response
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="output.pdf"`);
    reply.send(pdfBuffer);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error', message: error.message });
  }

}

async function addPagesToPDF(request, reply) {
  return reply.view("pages/addPagesPDF.ejs");
}

async function addPagesToPDFDownload(request, reply) {
  
  try {
    const { token } = request.params;

    console.log(token);
    const endPoint = "add-pages-pdf";

    // Validate token
    if (!token || !pdfStorage.has(token)) {
      return reply.redirect('/add-pages-pdf');
    }

    // Render the downloadPDF.ejs view with the token
    return reply.view('pages/downloadPDF.ejs', { token, endPoint, title : "Add Pages to PDF" });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error', message: error.message });
  }

}

async function addPagesToPDFDownloadFile(request, reply) {
  
  try {
    const { token } = request.params;
    
    console.log(token);

    // Validate token
    if (!token || !pdfStorage.has(token)) {
      return reply.status(400).send({ error: 'Invalid or expired token' });
    }
    
    // Retrieve PDF buffer
    const pdfBuffer = pdfStorage.get(token);

    // Delete the PDF from storage after retrieval
    pdfStorage.delete(token);
    
    // Send PDF response
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="output.pdf"`);
    reply.send(pdfBuffer);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error', message: error.message });
  }

}

async function mergePDF(request, reply) {
  return reply.view("pages/mergePDF.ejs");
}

async function mergePDFDownload(request, reply) {
  
  try {
    const { token } = request.params;

    console.log(token);
    const endPoint = "merge-pdf";

    // Validate token
    if (!token || !pdfStorage.has(token)) {
      return reply.redirect('/merge-pdf');
    }

    // Render the downloadPDF.ejs view with the token
    return reply.view('pages/downloadPDF.ejs', { token, endPoint, title : "Merge PDF" });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error', message: error.message });
  }

}

async function mergePDFDownloadFile(request, reply) {
  
  try {
    const { token } = request.params;
    
    console.log(token);

    // Validate token
    if (!token || !pdfStorage.has(token)) {
      return reply.status(400).send({ error: 'Invalid or expired token' });
    }
    
    // Retrieve PDF buffer
    const pdfBuffer = pdfStorage.get(token);

    // Delete the PDF from storage after retrieval
    pdfStorage.delete(token);
    
    // Send PDF response
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="output.pdf"`);
    reply.send(pdfBuffer);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error', message: error.message });
  }

}

async function addPageNumberToPDF(request, reply) {
  return reply.view("pages/addPageNumberToPDF.ejs");
}

async function addPageNumberToPDFDownload(request, reply) {
  
  try {
    const { token } = request.params;

    console.log(token);
    const endPoint = "merge-pdf";

    // Validate token
    if (!token || !pdfStorage.has(token)) {
      return reply.redirect('/add-page-numbers');
    }

    // Render the downloadPDF.ejs view with the token
    return reply.view('pages/downloadPDF.ejs', { token, endPoint, title : "Add Page Number to PDF" });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error', message: error.message });
  }

}

async function addPageNumberToPDFDownloadFile(request, reply) {
  
  try {
    const { token } = request.params;
    
    console.log(token);

    // Validate token
    if (!token || !pdfStorage.has(token)) {
      return reply.status(400).send({ error: 'Invalid or expired token' });
    }
    
    // Retrieve PDF buffer
    const pdfBuffer = pdfStorage.get(token);

    // Delete the PDF from storage after retrieval
    pdfStorage.delete(token);
    
    // Send PDF response
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="output.pdf"`);
    reply.send(pdfBuffer);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error', message: error.message });
  }

}

async function pageNotFound(request, reply) {
  return reply.status(404).view("pages/404.ejs");
}

module.exports = {
  homePage,
  imageToPDF,
  imageToPDFDownload,
  imageToPDFDownloadFile,
  pageNotFound,
  addPagesToPDF,
  addPagesToPDFDownload,
  addPagesToPDFDownloadFile,
  mergePDF,
  mergePDFDownload,
  mergePDFDownloadFile,
  addPageNumberToPDF,
  addPageNumberToPDFDownload,
  addPageNumberToPDFDownloadFile
};