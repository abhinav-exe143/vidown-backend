const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json()); // ✅ JSON parsing enable

const YT_DLP_PATH = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

// 🔥 Download Route (Vercel ke liye `/tmp/` use karna zaroori hai)
app.get("/download", (req, res) => {
    console.log("🔥 Request received at /download");

    let videoUrl = req.query.url;
    if (!videoUrl) {
        return res.status(400).json({ error: "URL required" });
    }

    console.log("🎥 Downloading video from:", videoUrl);

    const outputPath = `/tmp/%(title)s.%(ext)s`;  // ✅ VerceI compatible path
    const command = `"${YT_DLP_PATH}" -f b --merge-output-format mp4 -o "${outputPath}" "${videoUrl}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.log("❌ Download error:", stderr);
            return res.status(500).json({ error: "Download failed", details: stderr });
        }
        console.log("✅ Download success!", stdout);
        res.json({ message: "Download started!", videoUrl });
    });
});

// 🔍 Video Info Route
app.get("/info", (req, res) => {
    let videoUrl = req.query.url;
    if (!videoUrl) {
        return res.status(400).json({ error: "URL required" });
    }

    const command = `"${YT_DLP_PATH}" -J "${videoUrl}"`; // ✅ JSON output
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.log("❌ Error fetching info:", stderr);
            return res.status(500).json({ error: "Failed to fetch video info", details: stderr });
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

// ✅ Dynamic Port for Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
