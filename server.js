const express = require("express");
const cors = require("cors");
const YTDlpWrap = require("yt-dlp-wrap").default; // ✅ Node.js friendly yt-dlp
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Initialize yt-dlp wrapper
const ytDlp = new YTDlpWrap();

// 🔥 Download Route
app.get("/download", async (req, res) => {
    console.log("🔥 Request received at /download");

    let videoUrl = req.query.url;
    if (!videoUrl) {
        return res.status(400).json({ error: "URL required" });
    }

    console.log("🎥 Downloading video from:", videoUrl);

    const outputPath = "/tmp/video.mp4"; // ✅ Render/Vercel compatible path
    const args = ["-f", "b", "--merge-output-format", "mp4", "-o", outputPath, videoUrl];

    try {
        await ytDlp.execPromise(args);
        console.log("✅ Download success!");

        // ✅ Send file for direct download
        res.download(outputPath, "video.mp4", (err) => {
            if (err) {
                console.log("❌ Error sending file:", err);
                res.status(500).json({ error: "Error sending file" });
            }
            // ✅ Delete file after sending to save storage
            fs.unlinkSync(outputPath);
        });

    } catch (error) {
        console.log("❌ Download error:", error);
        res.status(500).json({ error: "Download failed", details: error.message });
    }
});

// 🔍 Video Info Route
app.get("/info", async (req, res) => {
    let videoUrl = req.query.url;
    if (!videoUrl) {
        return res.status(400).json({ error: "URL required" });
    }

    try {
        const output = await ytDlp.execPromise(["-J", videoUrl]); // ✅ JSON output
        const videoData = JSON.parse(output);

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
    } catch (error) {
        console.error("❌ Error fetching info:", error);
        res.status(500).json({ error: "Failed to fetch video info", details: error.message });
    }
});

// ✅ Dynamic Port for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

