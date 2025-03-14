const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "https://vidown-backend.onrender.com/" }));

const downloadsDir = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

const ytDlpPath = path.join(__dirname, "yt-dlp");

app.get("/download", (req, res) => {
  console.log("🔥 Request received at /download");

  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: "URL required" });
  }

  console.log("🎥 Downloading video from:", videoUrl);

  exec(`${ytDlpPath} ${videoUrl} -f b --merge-output-format mp4 -o downloads/%(title)s.%(ext)s`, (error, stdout, stderr) => {
    if (error) {
      console.log("❌ Download error:", error);
      return res.status(500).json({ error: "Download failed", details: error.message });
    }
    console.log("✅ Download success!", stdout);
    res.json({ message: "Download started!", videoUrl });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

app.get("/info", (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: "URL required" });
  }

  exec(`${ytDlpPath} ${videoUrl} -J`, (error, stdout, stderr) => {
    if (error) {
      console.log("❌ Error fetching info:", error);
      return res.status(500).json({ error: "Failed to fetch video info", details: error.message });
    }

    try {
      const videoData = JSON.parse(stdout);
      const availableFormats = videoData.formats.map(format => ({
        id: format.format_id,
        label: `${format.ext} - ${format.format_note}`,
        quality: format.format_note,
        format: format.ext,
        size: format.filesize ? `${(format.filesize / 1024 / 1024).toFixed(2)} MB` : "Unknown"
      }));

      res.json({
        id: videoData.id,
        title: videoData.title,
        thumbnail: videoData.thumbnail,
        duration: videoData.duration,
        availableFormats,
        source: videoData.extractor
      });
    } catch (parseError) {
      console.error("❌ Error parsing info:", parseError);
      res.status(500).json({ error: "Failed to parse video info" });
    }
  });
});
