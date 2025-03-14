const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "*" })); // Allow requests from any domain (update in production)

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
} else {
  console.error("❌ COOKIES_DATA environment variable is missing");
  process.exit(1); // Exit if cookies data is not provided
}

// Validate YouTube URL
const isValidYouTubeUrl = (url) => {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  return regex.test(url);
};

// Download endpoint
app.get("/download", (req, res) => {
  console.log("🔥 Request received at /download");

  const videoUrl = req.query.url;
  if (!videoUrl || !isValidYouTubeUrl(videoUrl)) {
    console.log("❌ Invalid or missing YouTube URL");
    return res.status(400).json({ error: "Invalid or missing YouTube URL" });
  }

  console.log("🎥 Downloading video from:", videoUrl);

  // Use yt-dlp to get the video stream
  const ytDlpProcess = exec(`${ytDlpPath} --cookies ${cookiesPath} ${videoUrl} -f "bv*+ba/b" --merge-output-format mp4 -o -`);

  // Set headers to force download
  res.setHeader("Content-Disposition", 'attachment; filename="video.mp4"');
  res.setHeader("Content-Type", "video/mp4");

  // Stream the video to the client
  ytDlpProcess.stdout.pipe(res);

  // Handle stream errors
  ytDlpProcess.stdout.on("error", (error) => {
    console.error("❌ Stream error:", error);
    res.status(500).end();
  });

  // Handle process errors
  ytDlpProcess.on("error", (error) => {
    console.error("❌ Process error:", error);
    res.status(500).end();
  });

  // Handle client disconnection
  res.on("close", () => {
    console.log("🚪 Client disconnected");
    ytDlpProcess.kill();
  });

  // Handle process exit
  ytDlpProcess.on("exit", (code) => {
    if (code !== 0) {
      console.error("❌ yt-dlp process exited with code:", code);
    } else {
      console.log("✅ Video stream completed successfully");
    }
  });
});

// Info endpoint
app.get("/info", (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl || !isValidYouTubeUrl(videoUrl)) {
    return res.status(400).json({ error: "Invalid or missing YouTube URL" });
  }

  exec(`${ytDlpPath} --cookies ${cookiesPath} ${videoUrl} -J`, { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Error fetching info:", error);
      console.error("stderr:", stderr);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
