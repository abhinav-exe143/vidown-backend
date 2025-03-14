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

// Write cookies from environment variable to a file
const cookiesData = process.env.COOKIES_DATA;
const cookiesPath = path.join(__dirname, "cookies.txt");
if (cookiesData) {
  // Replace escaped newlines and tabs with actual characters
  const formattedCookies = cookiesData.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  fs.writeFileSync(cookiesPath, formattedCookies);
}

app.get("/download", (req, res) => {
  console.log("🔥 Request received at /download");

  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: "URL required" });
  }

  console.log("🎥 Downloading video from:", videoUrl);

  // Use yt-dlp to get the video stream
  const ytDlpProcess = exec(`${ytDlpPath} --cookies ${cookiesPath} ${videoUrl} -f b --merge-output-format mp4 -o -`, (error, stdout, stderr) => {
    if (error) {
      console.log("❌ Download error:", error);
      console.log("stderr:", stderr);
      return res.status(500).json({ error: "Download failed", details: error.message });
    }
  });

  // Set headers to force download
  res.setHeader("Content-Disposition", 'attachment; filename="video.mp4"');
  res.setHeader("Content-Type", "video/mp4");

  // Stream the video to the client
  ytDlpProcess.stdout.pipe(res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

app.get("/info", (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: "URL required" });
  }

  exec(`${ytDlpPath} --cookies ${cookiesPath} ${videoUrl} -J`, (error, stdout, stderr) => {
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
