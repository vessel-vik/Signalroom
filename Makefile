.PHONY: help check demo serve smoke eval
MODEL ?= qwen2.5:7b-instruct
PORT ?= 8080

help:
	@echo "SignalRoom - make targets"
	@echo "  make check   Self-check + unit tests            (no model needed)"
	@echo "  make demo    Serve the dashboard and open it     (committed results, no model)"
	@echo "  make serve   Serve the dashboard                 (http://127.0.0.1:$(PORT)/web/)"
	@echo "  make smoke   Fast one-case evaluation            (needs Ollama + MODEL)"
	@echo "  make eval    Full 12-case baseline vs advanced   (needs Ollama + MODEL)"
	@echo "  Override:    make eval MODEL=llama3.1:8b PORT=9000"

check:
	python3 signalroom.py self-check
	python3 -m unittest discover -s tests

demo:
	python3 signalroom.py serve --port $(PORT) --open

serve:
	python3 signalroom.py serve --port $(PORT)

smoke:
	python3 signalroom.py --model $(MODEL) evaluate --limit 1

eval:
	python3 signalroom.py --model $(MODEL) evaluate
