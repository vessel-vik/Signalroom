# Reproduction guide

This guide assumes a clean environment and no access to the original development machine.

## Versions

- macOS or Linux
- Python 3.9 or newer (the code is standard-library-only); evaluated with 3.9.6
- Ollama 0.11 or newer; evaluated with 0.33.2
- Model: `qwen2.5:7b-instruct`, Ollama digest `845dbda0ea48` on the development machine

## Setup

```bash
git clone https://github.com/vessel-vik/Signalroom.git signalroom
cd signalroom
ollama pull qwen2.5:7b-instruct
ollama serve
```

Keep `ollama serve` running in one terminal. No API key, `.env` file, virtual environment, package install, network service, or private dataset is required.

## 1. Verify the code without a model

```bash
python3 signalroom.py self-check
python3 -m unittest discover -s tests -v
```

Expected: one self-check and three unit tests pass.

## 2. Run the simple baseline

```bash
python3 signalroom.py --model qwen2.5:7b-instruct run inc-01 --mode baseline
```

Expected: JSON printed to the terminal and written to `artifacts/inc-01-baseline.json`. The baseline receives only the five-line initial packet. On the recorded run it selected the wrong diagnosis and scored 25/100.

## 3. Run the advanced workflow

```bash
python3 signalroom.py --model qwen2.5:7b-instruct run inc-01 --mode advanced
```

Expected: the trajectory shows a plan, 1-4 allowlisted tool calls, an evidence-backed decision, deterministic citation resolution, and a safety check. The recorded run found database pool exhaustion and scored 100/100.

## 4. Run the hard abstention case

```bash
python3 signalroom.py --model qwen2.5:7b-instruct run inc-12 --mode advanced
```

Expected behavior: abstain or explicitly state that the decisive per-job exception/trace evidence is missing. A confident diagnosis is counted as a miss.

## 5. Reproduce the main comparison

```bash
python3 signalroom.py --model qwen2.5:7b-instruct evaluate
```

The command runs baseline and advanced modes on the same 12 cases and writes:

- `artifacts/evaluation.json` — full predictions, scores, tool responses, verification checks, and trajectories.
- `web/results.json` — the same data used by the dashboard.

The model runs with temperature `0`, seed `42`, and an 8192-token context. Local inference can still vary slightly by Ollama/model build; the deterministic verifier and scorer do not.

## 6. View the dashboard

```bash
python3 signalroom.py serve --port 8080
```

Open <http://127.0.0.1:8080/web/>. Select cases from the left rail or choose **Show the abstention case**.

## Data and expected output

`data/cases.json` contains all synthetic input, read-only tool output, diagnosis labels, and evaluation ground truth. The model is never shown `ground_truth`; only the scorer reads it.

Each result contains:

- plan and selected tools (advanced only);
- normalized diagnosis or abstention decision;
- exact citations;
- deterministic citation and action-safety checks;
- weighted decision-quality score;
- complete agent trajectory and latency.

## Runtime and cost

On an Apple Silicon laptop, one direct baseline call took about 42 seconds and one two-stage advanced run took about 46 seconds after the model was warm. A full 24-run evaluation is expected to take roughly 15-25 minutes depending on hardware and model loading. API cost is $0; inference runs locally. Disk cost is dominated by the Ollama model (about 4.7 GB).

## Troubleshooting

- `Connection refused`: run `ollama serve`.
- `model not found`: run `ollama pull qwen2.5:7b-instruct`.
- JSON parse error: rerun the case once and preserve the failed raw output as evidence; do not edit the score by hand.
- Slow first run: Ollama is loading the model into memory. Subsequent calls should be faster.
