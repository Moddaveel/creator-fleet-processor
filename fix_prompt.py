f = open('index.js', 'r').read()

old = '''Return a JSON array like this:
[
  {
    "title": "clip title",
    "start_time": 120,
    "end_time": 180,
    "score": 85,
    "reasoning": "why this is a good clip",
    "hook": "opening hook for this clip"
  }
]'''

new = '''Return a JSON array like this:
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
platforms: choose from tiktok, youtube_shorts, instagram_reels, youtube based on clip length and type'''

if old in f:
    f = f.replace(old, new)
    open('index.js', 'w').write(f)
    print('done')
else:
    print('no match found')
