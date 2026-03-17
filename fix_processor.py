f = open('index.js', 'r').read()

old = '''      await supabase.from("clips").insert({
        vod_filename: file.originalname,
        title: clip.title,
        start_time: clip.start_time,
        end_time: clip.end_time,
        score: clip.score,
        reasoning: clip.reasoning,
        hook: clip.hook,
        status: "pending",
        clip_url: publicUrl,
      });'''

new = '''      await supabase.from("clips").insert({
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
      });'''

if old in f:
    f = f.replace(old, new)
    open('index.js', 'w').write(f)
    print('done')
else:
    print('no match found')
