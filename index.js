import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Health check
app.get("/", (req, res) => res.json({ status: "Creator Fleet Processor online" }));

// Upload VOD and process
app.post("/process", upload.single("vod"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  res.json({ message: "Processing started", jobId: file.filename });

  try {
    console.log("Uploading VOD to Supabase...");
    const vodBuffer = fs.readFileSync(file.path);
    const vodPath = `vods/${file.filename}.mp4`;
    await supabase.storage.from("vods").upload(vodPath, vodBuffer, { contentType: "video/mp4" });

    console.log("Getting video duration...");
    const duration = await getVideoDuration(file.path);
    console.log(`Duration: ${duration}s`);

    console.log("Running Clip Hunter...");
    const clips = await runClipHunter(duration, file.originalname);
    console.log(`Found ${clips.length} clip candidates`);

    console.log("Cutting clips...");
    for (const clip of clips) {
      const clipFilename = `clip_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
      const clipPath = path.join(__dirname, "uploads", clipFilename);

      await cutClip(file.path, clip.start_time, clip.end_time, clipPath);

      const clipBuffer = fs.readFileSync(clipPath);
      const storagePath = `clips/${clipFilename}`;
      await supabase.storage.from("clips").upload(storagePath, clipBuffer, { contentType: "video/mp4" });

      const { data: { publicUrl } } = supabase.storage.from("clips").getPublicUrl(storagePath);

      await supabase.from("clips").insert({
        vod_filename: file.originalname,
        title: clip.title,
        clip_summary: clip.reasoning,
        clip_score: clip.score,
        start_time: clip.start_time,
        end_time: clip.end_time,
        moment_type: clip.moment_type || "highlight",
        content_pillar: clip.content_pillar || "Entertainment",
        platforms: clip.platforms || ["tiktok", "youtube_shorts", "instagram_reels"],
        hook: clip.hook,
        status: "ready_for_review",
        clip_url: publicUrl,
      });

      fs.unlinkSync(clipPath);
    }

    fs.unlinkSync(file.path);
    console.log("Done!");

  } catch (err) {
    console.error("Processing error:", err);
    fs.unlinkSync(file.path);
  }
});

// Get all clips
app.get("/clips", async (req, res) => {
  const { data, error } = await supabase.from("clips").select("*").order("score", { ascending: false });
  if (error) return res.status(500).json({ error });
  res.json(data);
});

// Update clip status
app.patch("/clips/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const { data, error } = await supabase.from("clips").update({ status }).eq("id", id);
  if (error) return res.status(500).json({ error });
  res.json(data);
});

function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration);
    });
  });
}

function cutClip(inputPath, startTime, endTime, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(endTime - startTime)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

async function runClipHunter(duration, filename) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `You are the Clip Hunter for a live-stream creator. Your job is to identify the best clip moments from a stream VOD. 
Score each clip 0-100: emotional impact, clarity, shareability, pillar alignment.
90+ = elite, 80-89 = strong, 70-79 = conditional.
Always return valid JSON only, no other text.`,
    messages: [{
      role: "user",
      content: `I have a stream VOD called "${filename}" that is ${Math.round(duration / 60)} minutes long.
      
Based on the duration, identify 5-8 potential clip moments spread throughout the stream.
Return a JSON array like this:
[
  {
    "title": "clip title",
    "start_time": 120,
    "end_time": 180,
    "score": 85,
    "reasoning": "why this is a good clip",
    "hook": "opening hook for this clip",
    "moment_type": "highlight",
    "content_pillar": "Entertainment",
    "platforms": ["tiktok", "youtube_shorts", "instagram_reels"]
  }
]

moment_type options: highlight, reaction, educational, funny, emotional
content_pillar options: Commentary, Live Interaction, Entertainment, Building in Public
platforms: choose from tiktok, youtube_shorts, instagram_reels, youtube based on clip length and type

Spread clips throughout the full ${Math.round(duration / 60)} minute duration. Keep clips 30-90 seconds long.`
    }]
  });

  const text = message.content[0].text;
  const json = text.match(/\[[\s\S]*\]/)?.[0];
  return JSON.parse(json);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Processor running on port ${PORT}`));
