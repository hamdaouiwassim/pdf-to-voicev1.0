const express = require("express");
const dotenv = require("dotenv");
const pdfParse = require("pdf-parse")
dotenv.config()
const cors = require("cors")
const fileUpload = require("express-fileupload");
const app = express();
app.use(cors())
app.use("/" , express.static("public"))
app.use(fileUpload())


app.post("/extract-text", async (req, res) => {
  try {
    if (!req.files || !req.files.pdfFile) {
      return res.status(400).send("No PDF file uploaded");
    }

    const pdfBuffer = req.files.pdfFile.data; // ✅ Correct usage
    const result = await pdfParse(pdfBuffer); // ✅ Await to handle errors
    res.send(result.text);
  } catch (err) {
    console.error("Error parsing PDF:", err.message);
    res.status(500).send("Failed to parse PDF. The file may be corrupted or invalid.");
  }
});


app.listen(process.env.PORT, ()=> {
    console.log("App listening" , process.env.PORT);
})