from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Depends
import subprocess
import os
import shutil
import uuid

app = FastAPI()

# Simple API Key security for the internal backend
API_KEY = os.getenv("EMO_BACKEND_SECRET", "kubo-emo-secret-placeholder")

async def verify_api_key(x_api_key: str = Header(None)):
    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")
    return x_api_key


# Ensure output directory exists
os.makedirs("output", exist_ok=True)

@app.post("/animate")
async def animate(
    source_image: UploadFile = File(...),
    driving_video: UploadFile = File(...),
    token: str = Depends(verify_api_key)
):
    """
    EMO: Emotive Portrait Alive integration
    This endpoint receives a source portrait and a driving video, 
    then runs the inference.py script to generate the animated result.
    """
    job_id = str(uuid.uuid4())
    source_path = f"source_{job_id}.jpg"
    driving_path = f"driving_{job_id}.mp4"
    output_path = f"output/result_{job_id}.mp4"

    try:
        with open(source_path, "wb") as f:
            f.write(await source_image.read())

        with open(driving_path, "wb") as f:
            f.write(await driving_video.read())

        # Inference call (Requires GPU and EMO environment)
        # Note: In a production environment, this should be handled by a task queue (e.g. Celery)
        process = subprocess.run([
            "python",
            "inference.py",
            "--source", source_path,
            "--driving", driving_path,
            "--output", output_path
        ], capture_output=True, text=True)

        if process.returncode != 0:
            return {"status": "error", "message": process.stderr}

        return {
            "status": "success",
            "video": output_path,
            "job_id": job_id
        }
    finally:
        # Cleanup input files
        if os.path.exists(source_path): os.remove(source_path)
        if os.path.exists(driving_path): os.remove(driving_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
