# Video Transcoder Service

A Node.js background service for transcoding videos using native FFmpeg binaries. Designed to handle large video files that exceed Supabase Edge Function memory limits.

## Features

- **Native FFmpeg Processing**: Uses FFmpeg static binaries for reliable video processing
- **VP9 WebM Output**: Converts videos to WebM format with VP9 video codec and Opus audio
- **Automatic Scaling**: Scales down videos larger than 1920px width while maintaining aspect ratio  
- **Poster Generation**: Creates JPEG poster frames at 1 second mark
- **Supabase Integration**: Downloads source files and uploads processed results to Supabase Storage
- **Database Updates**: Automatically updates media records with processing status and metadata
- **Comprehensive Logging**: Structured logging with Pino for monitoring and debugging
- **Health Monitoring**: Built-in health checks and graceful shutdown handling

## Environment Variables

Required:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for storage and database access)

Optional:
- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (development/production) 
- `LOG_LEVEL` - Logging level (debug/info/warn/error)
- `DEFAULT_CRF` - Default CRF value for encoding (default: 30)

## API Endpoints

### POST /jobs/transcode

Transcodes a video file from raw storage to processed WebM format.

**Request Body:**
```json
{
  "bucket": "content",
  "path": "raw/uuid/filename.mov", 
  "mediaId": "database-record-id",
  "crf": 30
}
```

**Response:**
```json
{
  "ok": true,
  "mediaId": "database-record-id",
  "processingTime": 45000,
  "result": {
    "webmPath": "processed/uuid/filename.webm",
    "posterPath": "processed/uuid/filename.jpg", 
    "compressionRatio": 67,
    "originalSize": 180000000,
    "webmSize": 59400000,
    "dimensions": "1920x1080",
    "duration": 125.5
  }
}
```

### GET /health

Health check endpoint returning service status and metrics.

## FFmpeg Configuration

The service uses these optimized FFmpeg settings:

```bash
ffmpeg -i input.mov \
  -c:v libvpx-vp9 -b:v 0 -crf 30 -row-mt 1 -g 240 -pix_fmt yuv420p \
  -vf "scale='min(1920,iw)':'-2':flags=lanczos" \
  -c:a libopus -b:a 96k -ac 2 -ar 48000 \
  -movflags +faststart \
  output.webm
```

## Deployment

### Docker

```bash
# Build the image
docker build -t video-transcoder .

# Run the container  
docker run -p 8080:8080 \
  -e SUPABASE_URL="https://your-project.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="your-service-key" \
  video-transcoder
```

### Render/Fly.io

1. Push code to GitHub repository
2. Connect to Render/Fly.io 
3. Set environment variables
4. Deploy with Docker configuration

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production  
npm run build

# Start production server
npm start
```

## Monitoring

The service provides structured logging and metrics:

- Request/response logging with timing
- FFmpeg command and progress logging  
- Error tracking with stack traces
- Resource usage monitoring
- Processing statistics (compression ratios, file sizes)

## Error Handling

- Automatic retry logic for transient failures
- Graceful degradation when FFmpeg processing fails
- Database status updates for all processing stages  
- Comprehensive error reporting and logging
- Temporary file cleanup on success or failure

## Security

- Service role authentication with Supabase
- Input validation on all endpoints
- Secure temporary file handling
- No file persistence beyond processing window
- CORS protection for browser requests