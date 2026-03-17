f = open('index.js', 'r').read()
f = f.replace(
    'import ffmpegStatic from "ffmpeg-static";',
    'import ffmpegStatic from "ffmpeg-static";\nimport ffprobeStatic from "ffprobe-static";'
)
f = f.replace(
    'ffmpeg.setFfmpegPath(ffmpegStatic);',
    'ffmpeg.setFfmpegPath(ffmpegStatic);\nffmpeg.setFfprobePath(ffprobeStatic.path);'
)
open('index.js', 'w').write(f)
print('done')
