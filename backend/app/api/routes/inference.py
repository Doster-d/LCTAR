import asyncio
import logging
import os
import pathlib
import shutil
import subprocess
import traceback
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.config import settings
from app.i18n.translator import translator
from app.services.inference.pipeline import run_inference

logger = logging.getLogger(__name__)
router = APIRouter()
DATA = pathlib.Path(settings.DATA_DIR)


def run(cmd, cwd=None):
    p = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    out = []
    assert p.stdout is not None
    for line in p.stdout:
        out.append(line)
    rc = p.wait()
    if rc != 0:
        raise RuntimeError(
            f'Command failed ({rc}): {" ".join(cmd)}\n' + ''.join(out)
        )
    return ''.join(out)


async def run_async(cmd, cwd=None, label: str | None = None):
    """Async version of run() that does not block the event loop.
    Logs start, success, and failure with combined output.
    """
    display = label or cmd[0]
    print('[RUN] %s :: %s', display, ' '.join(cmd))
    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    # Read stdout in binary chunks to avoid StreamReader.readline/readuntil LimitOverrunError
    lines: list[str] = []
    assert process.stdout is not None
    try:
        while True:
            chunk = await process.stdout.read(8192)
            if not chunk:
                break
            text = chunk.decode(errors='replace')
            # stream to logs as it arrives (trim trailing newlines for cleaner log lines)
            for ln in text.splitlines():
                print('%s: %s', display, ln)
            lines.append(text)
    except Exception as e:
        # If any read error occurs, capture what we have and continue to wait for the process
        print('run_async: stdout read error: %s', e)
    rc = await process.wait()
    output = ''.join(lines)
    if rc != 0:
        logger.error('[FAIL] %s (rc=%s)\n%s', display, rc, output)
        raise RuntimeError(
            f'Command failed ({rc}): {" ".join(cmd)}\n' + output
        )
    print('[OK] %s', display)
    return output


def cleanup(job):
    try:
        if job.exists():
            shutil.rmtree(job)
    except Exception:
        logger.warning('Failed to cleanup %s', job, exc_info=True)
        pass


class InferenceResponse(BaseModel):
    detected: bool
    bbox: dict | None
    depth_m: float | None
    height_m: float | None
    models: dict


@router.post('/frame', response_model=InferenceResponse)
async def inference_frame(
    request: Request,
    file: UploadFile = File(...),
    focal_length: float | None = None,
    character_id: int | None = None,
):
    locale = getattr(request.state, 'locale', settings.DEFAULT_LOCALE)
    if not settings.ENABLE_INFERENCE:
        raise HTTPException(
            status_code=503,
            detail=translator.t('errors.inference_disabled', locale=locale),
        )
    if focal_length is None:
        raise HTTPException(
            status_code=422,
            detail=translator.t('errors.focal_missing', locale=locale),
        )
    image_bytes = await file.read()
    result = run_inference(image_bytes, focal_length=focal_length)
    if character_id is not None:
        result['character_id'] = character_id
    return result


@router.post('/enhance')
async def enhance(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    scale: int = Form(2),
    use_nvenc: int = Form(1),
):
    job = DATA / str(uuid.uuid4())
    raw = job / 'raw.mp4'
    frames = job / 'frames'
    out = job / 'output.mp4'
    job.mkdir(parents=True, exist_ok=True)
    frames.mkdir()

    try:
        with open(raw, 'wb') as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        tb = traceback.format_exc()
        cleanup(job)
        raise HTTPException(
            status_code=500, detail=f'Failed to save uploaded file: {e}\n{tb}'
        ) from e

    # Simplified pipeline: run ffmpeg directly on the input video using the SRCNN model
    try:
        # Only accept SRCNN model names/paths
        model_candidates = [
            '/models/srcnn.pb',
            '/models/SRCNN.pb',
            'srcnn.pb',
            'SRCNN.pb',
        ]
        model_path = None
        for m in model_candidates:
            if pathlib.Path(m).exists():
                model_path = m
                break
        # fail early if SRCNN model isn't present
        if model_path is None:
            cleanup(job)
            raise HTTPException(
                status_code=500,
                detail=(
                    "SRCNN model not found. Place 'SRCNN.pb' or 'srcnn.pb' under /models or mount /models at runtime."
                ),
            )

        # Build ffmpeg command using the user's filter_complex SRCNN pipeline
        # parameterize scale (e.g. 2 or 4) and use the validated model_path
        ffmpeg_filter = (
            '[0:v]format=yuv420p,extractplanes=y+u+v[y][u][v];'
            + f'[y]scale=w=iw*{scale}:h=ih*{scale}:flags=bicubic,'
            + f'dnn_processing=dnn_backend=tensorflow:model={model_path}:input=x:output=y[y2];'
            + f'[u]scale=iw*{scale}:ih*{scale}[u2];'
            + f'[v]scale=iw*{scale}:ih*{scale}[v2];'
            + '[y2][u2][v2]mergeplanes=0x001020:yuv420p[v]'
        )

        # Choose encoder: prefer h264_nvenc when requested and available
        encoder = 'libx264'
        if int(use_nvenc) == 1:
            try:
                encs = run(['ffmpeg', '-hide_banner', '-encoders'])
                if 'h264_nvenc' in encs:
                    encoder = 'h264_nvenc'
            except Exception:
                # probe failed; fall back to CPU encoder
                encoder = 'libx264'

        threads = str(os.cpu_count() or 1)
        if encoder == 'h264_nvenc':
            cmd = [
                'ffmpeg',
                '-y',
                '-i',
                str(raw),
                '-filter_complex',
                ffmpeg_filter,
                '-map',
                '[v]',
                '-map',
                '0:a?',
                '-c:v',
                encoder,
                '-preset',
                'p7',
                '-b:v',
                '12M',
                '-pix_fmt',
                'yuv420p',
                '-c:a',
                'copy',
                str(out),
            ]
        else:
            # faster libx264 preset and threading
            cmd = [
                'ffmpeg',
                '-y',
                '-i',
                str(raw),
                '-filter_complex',
                ffmpeg_filter,
                '-map',
                '[v]',
                '-map',
                '0:a?',
                '-c:v',
                'libx264',
                '-crf',
                '18',
                '-preset',
                'veryfast',
                '-threads',
                threads,
                '-pix_fmt',
                'yuv420p',
                '-c:a',
                'copy',
                str(out),
            ]

        await run_async(cmd, label='ffmpeg-upscale')
    except HTTPException:
        raise
    except RuntimeError as e:
        tb = traceback.format_exc()
        cleanup(job)
        raise HTTPException(
            status_code=500, detail=f'ffmpeg upscaling failed: {e}\n{tb}'
        ) from e
    except Exception as e:
        tb = traceback.format_exc()
        cleanup(job)
        raise HTTPException(
            status_code=500,
            detail=f'Unexpected error during upscaling: {e}\n{tb}',
        ) from e

    background_tasks.add_task(cleanup, job)
    return FileResponse(
        path=str(out),
        media_type='video/mp4',
        filename=f'enhanced_{file.filename or "video"}.mp4',
    )


@router.get('/gpus')
async def list_gpus():
    """Return available GPU information.
    Tries nvidia-smi first; if not available, attempts a lightweight probe of the Vulkan binary help output.
    """
    # Try nvidia-smi
    try:
        out = run(
            [
                'nvidia-smi',
                '--query-gpu=index,name,memory.total',
                '--format=csv,noheader',
            ]
        )
        gpus = []
        for line in out.splitlines():
            parts = [p.strip() for p in line.split(',')]
            if len(parts) >= 3:
                gpus.append(
                    {
                        'index': int(parts[0]),
                        'name': parts[1],
                        'memory': parts[2],
                    }
                )
        return {'backend': 'nvidia-smi', 'gpus': gpus}
    except Exception as e:
        logger.warning('nvidia-smi not available or failed: %s', e)

    # Fallback: check if ffmpeg supports NVENC (h264_nvenc encoder) as a proxy for GPU support
    try:
        out = run(['ffmpeg', '-hide_banner', '-encoders'])  # small and safe
        supports_nvenc = 'h264_nvenc' in out
        return {'backend': 'ffmpeg', 'nvenc': supports_nvenc}
    except Exception as e:
        logger.warning('ffmpeg probe failed: %s', e)

    # Last resort: no probe available
    return {'backend': 'none', 'gpus': []}
