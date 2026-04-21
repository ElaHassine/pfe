const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function runPythonInference({ imagePath, modelPath, classNames }) {
  return new Promise((resolve, reject) => {
    const pythonPath = process.env.PYTHON_EXECUTABLE || 'python';
    const scriptPath = path.resolve(__dirname, '../ml/infer_pytorch.py');

    const args = [
      scriptPath,
      '--image', imagePath,
      '--model', modelPath,
      '--classes', classNames || '',
    ];

    const child = spawn(pythonPath, args, {
      cwd: path.resolve(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    child.on('close', (code) => {
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1] || '{}';

      let parsed = null;
      try {
        parsed = JSON.parse(lastLine);
      } catch (_error) {
        parsed = null;
      }

      if (code !== 0 || !parsed?.ok) {
        const message = parsed?.error || stderr.trim() || `Python inference exited with code ${code}`;
        reject(new Error(message));
        return;
      }

      resolve(parsed);
    });
  });
}

async function resolveModelPath(configuredPath) {
  const trimmed = String(configuredPath || '').trim();
  if (!trimmed) return null;

  try {
    const stat = await fs.stat(trimmed);
    if (stat.isFile()) {
      return trimmed;
    }

    if (stat.isDirectory()) {
      const files = await fs.readdir(trimmed);
      const candidate = files.find((name) => /\.(pt|pth)$/i.test(name));
      if (candidate) {
        return path.join(trimmed, candidate);
      }
    }
  } catch (_error) {
    return null;
  }

  return null;
}

async function inferLesionFromPyTorch(imageBuffer) {
  const modelPath = await resolveModelPath(process.env.PYTORCH_MODEL_PATH);
  if (!modelPath) {
    return null;
  }

  const classNames = process.env.MODEL_CLASS_NAMES || 'low,medium,high';
  const tempImagePath = path.join(os.tmpdir(), `lesio-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`);

  try {
    await fs.writeFile(tempImagePath, imageBuffer);
    return await runPythonInference({ imagePath: tempImagePath, modelPath, classNames });
  } finally {
    await fs.unlink(tempImagePath).catch(() => {});
  }
}

module.exports = {
  inferLesionFromPyTorch,
};
