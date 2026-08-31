.PHONY: help check web-check demo serve smoke eval ablate
MODEL ?= qwen2.5:7b-instruct
PORT ?= 8080

help:
	@echo "SignalRoom - make targets"
	@echo "  make check   Self-check + unit tests (Python, plus JS render test if node present)"
	@echo "  make demo    Serve the dashboard and open it     (committed results, no model)"
	@echo "  make serve   Serve the dashboard                 (http://127.0.0.1:$(PORT)/web/)"
	@echo "  make ablate  Component-contribution ablation     (from committed artifacts, no model)"
	@echo "  make smoke   Fast one-case evaluation            (needs Ollama + MODEL)"
	@echo "  make eval    Full 12-case baseline vs advanced   (needs Ollama + MODEL)"
	@echo "  Override:    make eval MODEL=llama3.1:8b PORT=9000"

check:
	python3 signalroom.py self-check
	python3 -m unittest discover -s tests
	@command -v node >/dev/null 2>&1 && node tests/test_dashboard.js || echo "(node not found; skipping dashboard render test)"

web-check:
	node tests/test_dashboard.js

demo:
	python3 signalroom.py serve --port $(PORT) --open

serve:
	python3 signalroom.py serve --port $(PORT)

ablate:
	python3 signalroom.py ablate

smoke:
	python3 signalroom.py --model $(MODEL) evaluate --limit 1

eval:
	python3 signalroom.py --model $(MODEL) evaluate
