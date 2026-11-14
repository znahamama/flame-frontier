PY := .venv/bin/python
.PHONY: setup data dev build check
setup:            ## one-time: Python venv, pipeline deps, node deps, git secret guard
	uv venv -q --allow-existing .venv --python 3.11
	uv pip install -q -p .venv -r scripts/requirements.txt
	npm install --no-audit --no-fund
	git config core.hooksPath .githooks
data:             ## run every numbered pipeline script (idempotent, no network, no LLM)
	$(PY) scripts/run_all.py
dev: data         ## pipeline + local dev server
	npm run dev
build: data       ## production build into web/dist
	npm run build
check:            ## prove secrets are untracked and the guard is active
	@git check-ignore -q .env && echo ".env ignored: yes" || (echo ".env NOT ignored" && exit 1)
	@test -z "$$(git ls-files .env)" && echo ".env tracked: no" || (echo ".env IS TRACKED" && exit 1)
	@test "$$(git config core.hooksPath)" = ".githooks" && echo "pre-commit guard: active" || (echo "guard inactive: run make setup" && exit 1)
